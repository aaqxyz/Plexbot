const { EmbedBuilder } = require('discord.js');

function buildStatusEmbed(serverStatuses) {
    const allOnline = serverStatuses.every((s) => s.online);
    const anyExpired = serverStatuses.some((s) => s.statusText === 'session_expired');

    const embed = new EmbedBuilder()
        .setTitle('Plex Server Status')
        .setColor(allOnline ? 0x00ff00 : 0xff0000)
        .setTimestamp()
        .setFooter({ text: 'Auto-refreshes every few minutes' });

    if (anyExpired) {
        embed.setDescription(
            '⚠️ **Dashboard session expired.** Run `node login.js` to re-authenticate.'
        );
    }

    for (const server of serverStatuses) {
        let statusIcon;
        let statusLabel;

        switch (server.statusText) {
            case 'session_expired':
                statusIcon = '⚠️';
                statusLabel = 'Session Expired';
                break;
            case 'error':
                statusIcon = '❓';
                statusLabel = 'Error';
                break;
            default:
                statusIcon = server.online ? '🟢' : '🔴';
                statusLabel = server.online ? 'Online' : 'Offline';
        }

        const timestamp = Math.floor(server.lastChecked.getTime() / 1000);

        embed.addFields({
            name: server.name,
            value: `${statusIcon} **${statusLabel}**\nLast checked: <t:${timestamp}:R>`,
            inline: false,
        });
    }

    return embed;
}

function buildStatusMessage(serverStatuses) {
    return {
        embeds: [buildStatusEmbed(serverStatuses)],
    };
}

module.exports = { buildStatusMessage };
