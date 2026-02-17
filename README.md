
# PlexBot - StreamBoy TV Server Management Discord Bot

![Status Embed](https://cdn.asuna.cat/u/uXuY6S.png)
![Slash Commands](https://cdn.asuna.cat/u/IW3Khg.png)

PlexBot is a Discord bot built to manage StreamBoy TV Plex servers. It uses slash commands to start, stop, and restart servers directly from Discord, and keeps a live status embed updated in a designated channel. It scrapes the StreamBoy dashboard using Playwright so you don't have to open it yourself.

---

## Features
- Admin-only slash commands: `/start`, `/stop`, `/restart` to control individual Plex servers.
- `/status` command to force-refresh the server status embed.
- Live status embed that auto-refreshes on a configurable interval.
- Multi-server support — manage as many servers as you need from a single bot.
- Detects expired dashboard sessions and warns you to re-authenticate.

---

## Prerequisites
1. **Node.js**: Install Node.js (v18 or above).
2. **PM2**: Install PM2 for continuous operation.

   ```bash
   npm install -g pm2
   ```
3. **Playwright**: Playwright browsers are installed automatically during `npm install`.

---

## Installation and Setup

### 1. Clone the Repository
```bash
git clone https://github.com/aaqxyz/Plexbot.git
cd PlexBot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure the Bot
Edit `config.json` with your Discord bot token, the channel ID where the status embed should be posted, and your server details:
```json
{
  "discordToken": "YOUR_DISCORD_BOT_TOKEN",
  "channelId": "YOUR_CHANNEL_ID",
  "refreshIntervalMinutes": 5,
  "servers": [
    {
      "name": "Private Plex Server",
      "dashboardUrl": "https://box.streamboy.tv/app/dashboard/XXXXX"
    },
    {
      "name": "Public Plex Server",
      "dashboardUrl": "https://box.streamboy.tv/app/dashboard/YYYYY"
    }
  ]
}
```

### 4. Log In to StreamBoy Dashboard
Run the login script to authenticate with the StreamBoy TV dashboard:
```bash
node login.js
```

- This opens a browser in non-headless mode. Log in manually with your credentials and ensure you select the "Remember Me" option.
- A `user_data` folder will be created to store your session data for the dashboard.

---

## Running the Bot

### Start the Bot with PM2
Run the bot as a PM2 task for continuous operation:
```bash
pm2 start bot.js --name plexbot
```

### Monitor Logs
To view real-time logs:
```bash
pm2 logs plexbot
```

### Managing the Bot
- **Restart**:
  ```bash
  pm2 restart plexbot
  ```
- **Stop**:
  ```bash
  pm2 stop plexbot
  ```

---

## Slash Commands
| Command | Description |
|---------|-------------|
| `/start <server>` | Start a Plex server |
| `/stop <server>` | Stop a Plex server |
| `/restart <server>` | Restart a Plex server |
| `/status` | Force-refresh the status embed |

All commands require **Administrator** permissions in the Discord server.

---

## File Structure
- `bot.js`: Main bot script — handles slash commands, status embeds, and auto-refresh.
- `dashboard.js`: Playwright-based scraper that reads server status and clicks action buttons on the StreamBoy dashboard.
- `embedBuilder.js`: Builds the Discord embed for displaying server statuses.
- `config.json`: Bot configuration (token, channel ID, server list).
- `login.js`: Opens a browser to manually log in to the StreamBoy dashboard and save the session.
- `user_data/`: Stores session data for the StreamBoy TV dashboard login.

---

## License
This project is licensed under the MIT License. See the LICENSE file for details.
