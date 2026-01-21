<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Discord Mirror Bot

This is a Node.js Discord bot that mirrors messages between two channels across different servers.

### Features
- Listens for messages in configured channels
- Forwards messages to paired channels with author info
- Supports webhooks for better message formatting

### Setup
1. Create a Discord bot at https://discord.com/developers/applications
2. Copy the bot token to `.env` file
3. Configure channel IDs in `config.json`
4. Run `npm install` then `npm start`
