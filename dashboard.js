const { chromium } = require('playwright');
const path = require('path');

let browserContext = null;
const serverLocks = new Map();

async function getBrowserContext() {
    if (!browserContext) {
        browserContext = await chromium.launchPersistentContext(
            path.join(__dirname, 'user_data'),
            { headless: true }
        );
    }
    return browserContext;
}

async function closeBrowser() {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
    }
}

async function scrapeStatus(server) {
    const context = await getBrowserContext();
    const page = await context.newPage();

    try {
        await page.goto(server.dashboardUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // Check if we got redirected to a login page (session expired)
        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
            console.log(`[${server.name}] Redirected to login page — session expired`);
            return {
                name: server.name,
                dashboardUrl: server.dashboardUrl,
                online: false,
                statusText: 'session_expired',
                lastChecked: new Date(),
            };
        }

        // Look for status indicators on the StreamBoy dashboard.
        // Strategy 1: Look for elements with status-related color classes or text
        const statusElement = await page.$(
            '[class*="bg-green"], [class*="bg-red"], [class*="badge"], [class*="status"]'
        );

        let statusText = 'unknown';
        if (statusElement) {
            statusText = (await statusElement.textContent()).trim().toLowerCase();
            console.log(`[${server.name}] Found status element with text: "${statusText}"`);
        } else {
            // Strategy 2: Search the full page text for status keywords
            const bodyText = await page.textContent('body');
            console.log(`[${server.name}] No status element found. Page text snippet: "${bodyText.substring(0, 300).replace(/\s+/g, ' ')}"`);
            if (/running|online|active/i.test(bodyText)) {
                statusText = 'online';
            } else if (/stopped|offline|inactive|down/i.test(bodyText)) {
                statusText = 'offline';
            }
        }

        const isOnline = /running|online|active/i.test(statusText);
        console.log(`[${server.name}] Final status: "${statusText}" → online=${isOnline}`);

        return {
            name: server.name,
            dashboardUrl: server.dashboardUrl,
            online: isOnline,
            statusText,
            lastChecked: new Date(),
        };
    } catch (error) {
        console.error(`Error scraping status for ${server.name}:`, error.message);
        return {
            name: server.name,
            dashboardUrl: server.dashboardUrl,
            online: false,
            statusText: 'error',
            lastChecked: new Date(),
            error: error.message,
        };
    } finally {
        await page.close();
    }
}

async function performAction(server, action) {
    const key = server.dashboardUrl;

    // Prevent concurrent actions on the same server
    if (serverLocks.get(key)) {
        return {
            success: false,
            action,
            server: server.name,
            error: 'Another action is already in progress for this server',
        };
    }

    serverLocks.set(key, true);
    const context = await getBrowserContext();
    const page = await context.newPage();

    try {
        await page.goto(server.dashboardUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        const buttonLabel = action.charAt(0).toUpperCase() + action.slice(1);

        // Strategy 1: Find button by its visible text using Playwright's role selector
        let button = page.getByRole('button', { name: new RegExp(buttonLabel, 'i') });
        let buttonCount = await button.count();

        if (buttonCount > 0) {
            await button.first().click();
        } else {
            // Strategy 2: Fallback to CSS class selector + text matching
            // (based on the original restart.js selector pattern)
            const buttons = await page.$$(
                'button.font-medium.items-center.border.shadow-sm.rounded-md'
            );

            let clicked = false;
            for (const btn of buttons) {
                const text = await btn.textContent();
                if (text && text.trim().toLowerCase().includes(action.toLowerCase())) {
                    await btn.click();
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                throw new Error(`Could not find ${action} button on dashboard`);
            }
        }

        console.log(`${action} button clicked for ${server.name}`);
        await page.waitForTimeout(3000);

        return { success: true, action, server: server.name };
    } catch (error) {
        console.error(`Error performing ${action} on ${server.name}:`, error.message);
        return {
            success: false,
            action,
            server: server.name,
            error: error.message,
        };
    } finally {
        serverLocks.delete(key);
        await page.close();
    }
}

async function debugDashboard(server) {
    const context = await getBrowserContext();
    const page = await context.newPage();

    try {
        await page.goto(server.dashboardUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        const filename = `debug_${server.name.replace(/\s+/g, '_')}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`Screenshot saved as ${filename}`);
        return filename;
    } catch (error) {
        console.error(`Error taking debug screenshot for ${server.name}:`, error.message);
        return null;
    } finally {
        await page.close();
    }
}

module.exports = { scrapeStatus, performAction, debugDashboard, closeBrowser };
