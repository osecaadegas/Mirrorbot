# Discord Mirror Bot

A Discord bot that mirrors messages between two channels across different servers.

## Features

- 🔄 Bi-directional message mirroring between channels
- 👤 Preserves author name and avatar using webhooks
- 📎 Supports attachments (images, files)
- 💬 Forwards embeds
- 🚫 Prevents mention pings in mirrored messages

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Reset Token" to get your bot token
5. Enable these **Privileged Gateway Intents**:
   - MESSAGE CONTENT INTENT
6. Go to "OAuth2" > "URL Generator"
7. Select scopes: `bot`
8. Select permissions: `Read Messages/View Channels`, `Send Messages`, `Manage Webhooks`, `Read Message History`
9. Copy the generated URL and invite the bot to **both** servers

### 2. Configure the Bot

1. Copy your bot token to `.env`:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

2. Get the channel IDs you want to mirror:
   - Enable Developer Mode in Discord (User Settings > App Settings > Advanced)
   - Right-click on a channel and select "Copy Channel ID"

3. Edit `config.json` with your channel IDs:
   ```json
   {
       "channelPairs": [
           {
               "channelA": "123456789012345678",
               "channelB": "987654321098765432"
           }
       ]
   }
   ```

### 3. Run the Bot

```bash
# Install dependencies
npm install

# Start the bot
npm start
```

## Adding More Channel Pairs

You can mirror multiple channel pairs by adding more entries to the `channelPairs` array:

```json
{
    "channelPairs": [
        {
            "channelA": "CHANNEL_ID_1",
            "channelB": "CHANNEL_ID_2"
        },
        {
            "channelA": "CHANNEL_ID_3",
            "channelB": "CHANNEL_ID_4"
        }
    ]
}
```

## Requirements

- Node.js 16.9.0 or higher
- Bot must be in both servers
- Bot needs "Manage Webhooks" permission in both channels
