const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const { scrapeStatus, performAction, closeBrowser } = require('./dashboard');
const { buildStatusMessage } = require('./embedBuilder');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const dataFile = path.join(__dirname, 'data.json');

function loadMessageId() {
    try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        return data.statusMessageId || null;
    } catch {
        return null;
    }
}

function saveMessageId(id) {
    fs.writeFileSync(dataFile, JSON.stringify({ statusMessageId: id }), 'utf8');
}

let statusMessageId = loadMessageId();

// Build server choices for slash commands from config
const serverChoices = config.servers.map((s, i) => ({
    name: s.name,
    value: String(i),
}));

// Define slash commands (admin-only)
const commands = [
    new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a Plex server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((option) =>
            option
                .setName('server')
                .setDescription('Which server to start')
                .setRequired(true)
                .addChoices(...serverChoices)
        ),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop a Plex server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((option) =>
            option
                .setName('server')
                .setDescription('Which server to stop')
                .setRequired(true)
                .addChoices(...serverChoices)
        ),
    new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restart a Plex server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((option) =>
            option
                .setName('server')
                .setDescription('Which server to restart')
                .setRequired(true)
                .addChoices(...serverChoices)
        ),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Force refresh the server status embed')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

async function registerCommands(clientId) {
    const rest = new REST().setToken(config.discordToken);

    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(clientId), {
            body: commands.map((c) => c.toJSON()),
        });
        console.log('Slash commands registered.');
    } catch (error) {
        console.error('Error registering commands:', error.message);
    }
}

async function refreshStatus(channel) {
    try {
        // Scrape servers sequentially to avoid browser context conflicts
        const statuses = [];
        for (const server of config.servers) {
            statuses.push(await scrapeStatus(server));
        }

        const messagePayload = buildStatusMessage(statuses);

        if (statusMessageId) {
            try {
                const existingMessage = await channel.messages.fetch(statusMessageId);
                await existingMessage.edit(messagePayload);
                console.log(`Status embed updated at ${new Date().toISOString()}`);
            } catch {
                console.log('Previous status message not found, sending new one');
                const newMessage = await channel.send(messagePayload);
                statusMessageId = newMessage.id;
                saveMessageId(statusMessageId);
            }
        } else {
            const newMessage = await channel.send(messagePayload);
            statusMessageId = newMessage.id;
            saveMessageId(statusMessageId);
            console.log(`Status embed sent (message ID: ${statusMessageId})`);
        }
    } catch (error) {
        console.error('Error refreshing status:', error.message);
    }
}

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);

    // Register slash commands
    await registerCommands(readyClient.user.id);

    const channel = await client.channels.fetch(config.channelId);
    if (!channel) {
        console.error(
            'Could not find the configured channel. Check channelId in config.json'
        );
        return;
    }

    // Initial status scrape and embed send
    await refreshStatus(channel);

    // Auto-refresh on interval
    const intervalMs = (config.refreshIntervalMinutes || 5) * 60 * 1000;
    setInterval(() => refreshStatus(channel), intervalMs);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (['start', 'stop', 'restart'].includes(commandName)) {
        const serverIndex = parseInt(interaction.options.getString('server'), 10);

        if (isNaN(serverIndex) || serverIndex >= config.servers.length) {
            await interaction.reply({ content: 'Invalid server selection.', ephemeral: true });
            return;
        }

        const server = config.servers[serverIndex];

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await performAction(server, commandName);

            if (result.success) {
                await interaction.editReply({
                    content: `Successfully executed **${commandName}** on **${server.name}**. Status will update shortly.`,
                });
            } else {
                await interaction.editReply({
                    content: `Failed to execute **${commandName}** on **${server.name}**: ${result.error}`,
                });
            }

            // Refresh the embed after a delay to let the action take effect
            setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(config.channelId);
                    await refreshStatus(channel);
                } catch (err) {
                    console.error('Error refreshing after action:', err.message);
                }
            }, 5000);
        } catch (error) {
            await interaction.editReply({ content: `Error: ${error.message}` });
        }
    }

    if (commandName === 'status') {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = await client.channels.fetch(config.channelId);
            await refreshStatus(channel);
            await interaction.editReply({ content: 'Status embed refreshed.' });
        } catch (error) {
            await interaction.editReply({ content: `Error: ${error.message}` });
        }
    }
});

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await closeBrowser();
    client.destroy();
    process.exit(0);
});

client.login(config.discordToken);
