const { chromium } = require('playwright');
const path = require('path');

let config;
try {
    config = require('./config.json');
} catch {
    console.log('No config.json found. Using default URL.');
    config = {
        servers: [
            {
                name: 'Default',
                dashboardUrl: 'https://box.streamboy.tv/app/dashboard/XXXX',
            },
        ],
    };
}

(async () => {
    const browser = await chromium.launchPersistentContext(
        path.join(__dirname, 'user_data'),
        { headless: false }
    );

    const page = await browser.newPage();

    try {
        const loginUrl = config.servers[0].dashboardUrl;
        console.log(`Navigating to: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle' });

        console.log('Browser launched in non-headless mode with persistent context.');
        console.log('Please log in manually. The session will be saved in ./user_data.');
        console.log('');
        console.log('After logging in, verify access to each server dashboard:');

        for (let i = 0; i < config.servers.length; i++) {
            console.log(`  ${i + 1}. ${config.servers[i].name}: ${config.servers[i].dashboardUrl}`);
        }

        console.log('');
        console.log('Press CTRL+C to exit once you have completed the login process.');

        await new Promise(() => {});
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
})();
