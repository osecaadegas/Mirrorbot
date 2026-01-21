const { Client, GatewayIntentBits, EmbedBuilder, WebhookClient } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');

// Create the Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Store webhooks for each channel pair
const webhooks = new Map();

// Initialize webhooks for mirroring
async function initializeWebhooks() {
    for (const pair of config.channelPairs) {
        try {
            // Get or create webhook for channel A
            const channelA = await client.channels.fetch(pair.channelA);
            const channelB = await client.channels.fetch(pair.channelB);

            if (channelA && channelB) {
                // Get existing webhooks or create new ones
                const webhooksA = await channelA.fetchWebhooks();
                const webhooksB = await channelB.fetchWebhooks();

                let webhookA = webhooksA.find(wh => wh.name === 'Mirror Bot');
                let webhookB = webhooksB.find(wh => wh.name === 'Mirror Bot');

                if (!webhookA) {
                    webhookA = await channelA.createWebhook({
                        name: 'Mirror Bot',
                        reason: 'Mirror bot webhook for message forwarding'
                    });
                }

                if (!webhookB) {
                    webhookB = await channelB.createWebhook({
                        name: 'Mirror Bot',
                        reason: 'Mirror bot webhook for message forwarding'
                    });
                }

                // Store webhook clients
                webhooks.set(pair.channelA, new WebhookClient({ url: webhookB.url }));
                webhooks.set(pair.channelB, new WebhookClient({ url: webhookA.url }));

                console.log(`✅ Initialized webhook pair: ${channelA.name} <-> ${channelB.name}`);
            }
        } catch (error) {
            console.error(`❌ Error initializing webhooks for pair:`, error);
        }
    }
}

// When the bot is ready
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    console.log(`📡 Monitoring ${config.channelPairs.length} channel pair(s)`);
    console.log(`📋 Channel IDs being watched: ${config.channelPairs.map(p => `${p.channelA}, ${p.channelB}`).join('; ')}`);
    
    // Check bot permissions in each channel
    for (const pair of config.channelPairs) {
        try {
            const chA = await client.channels.fetch(pair.channelA);
            const chB = await client.channels.fetch(pair.channelB);
            console.log(`🔍 Channel A (${chA.name}): Can view = ${chA.permissionsFor(client.user).has('ViewChannel')}, Can read history = ${chA.permissionsFor(client.user).has('ReadMessageHistory')}`);
            console.log(`🔍 Channel B (${chB.name}): Can view = ${chB.permissionsFor(client.user).has('ViewChannel')}, Can read history = ${chB.permissionsFor(client.user).has('ReadMessageHistory')}`);
        } catch (e) {
            console.log(`❌ Error checking permissions: ${e.message}`);
        }
    }
    
    await initializeWebhooks();
    console.log('✅ Bot is ready to mirror messages!');
});

// Debug: log all raw events
client.on('raw', (event) => {
    if (event.t === 'MESSAGE_CREATE') {
        console.log(`🔔 RAW MESSAGE_CREATE event in channel: ${event.d.channel_id}`);
    }
});

// Listen for messages
client.on('messageCreate', async (message) => {
    console.log(`📩 Message received in channel: ${message.channel.id} from ${message.author.tag}`);
    
    // Ignore bot messages and system messages
    if (message.author.bot || message.system) {
        console.log('   ↳ Ignored (bot or system message)');
        return;
    }

    // Check if this channel is being mirrored
    const webhook = webhooks.get(message.channel.id);
    if (!webhook) {
        console.log(`   ↳ Channel ${message.channel.id} is not in mirror list`);
        return;
    }

    try {
        // Prepare message content
        const content = message.content || '';
        
        // Handle attachments
        const files = message.attachments.map(attachment => ({
            attachment: attachment.url,
            name: attachment.name
        }));

        // Handle embeds (if any)
        const embeds = message.embeds.filter(embed => embed.type === 'rich');

        // Send the mirrored message via webhook
        await webhook.send({
            content: content || undefined,
            username: `${message.author.displayName} (from ${message.guild.name})`,
            avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            files: files.length > 0 ? files : undefined,
            embeds: embeds.length > 0 ? embeds : undefined,
            allowedMentions: { parse: [] } // Prevent pinging users in mirrored messages
        });

        console.log(`📨 Mirrored message from ${message.author.tag} in ${message.guild.name}/#${message.channel.name}`);
    } catch (error) {
        console.error('❌ Error mirroring message:', error);
    }
});

// Handle errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
