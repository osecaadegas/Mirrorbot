const { Client, GatewayIntentBits, EmbedBuilder, WebhookClient, SlashCommandBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load config from file (mutable)
const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Save config to file
function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// Simple HTTP server to keep Render happy (free tier requires a web service)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord Mirror Bot is running!');
}).listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
});

// Create the Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Store webhooks for each channel (maps channelId -> array of webhook clients for other channels)
const webhooks = new Map();

// Define slash commands - simplified for single global sync
const commands = [
    new SlashCommandBuilder()
        .setName('mirror')
        .setDescription('Configure channel mirroring for double account detection')
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Link this channel to the global sync network')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Remove this channel from the sync network')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all linked channels across all servers')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check if this channel is linked')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
];

// Register slash commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

// Initialize webhooks for all linked channels
async function initializeWebhooks() {
    webhooks.clear();
    
    const linkedChannels = config.linkedChannels || [];
    if (linkedChannels.length < 2) {
        console.log('⚠️ Need at least 2 channels linked to start mirroring');
        return;
    }
    
    const channelWebhooks = new Map();
    
    // Get or create webhook for each channel
    for (const channelId of linkedChannels) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) continue;
            
            const existingWebhooks = await channel.fetchWebhooks();
            let webhook = existingWebhooks.find(wh => wh.name === 'Mirror Bot');
            
            if (!webhook) {
                webhook = await channel.createWebhook({
                    name: 'Mirror Bot',
                    reason: 'Mirror bot for double account detection'
                });
            }
            channelWebhooks.set(channelId, webhook);
            console.log(`   ✅ Webhook ready for #${channel.name} (${channel.guild.name})`);
        } catch (e) {
            console.error(`   ❌ Could not setup webhook for ${channelId}:`, e.message);
        }
    }
    
    // For each channel, create webhook clients for ALL OTHER channels
    for (const channelId of linkedChannels) {
        const targetWebhooks = [];
        for (const [otherId, webhook] of channelWebhooks) {
            if (otherId !== channelId) {
                targetWebhooks.push(new WebhookClient({ url: webhook.url }));
            }
        }
        if (targetWebhooks.length > 0) {
            webhooks.set(channelId, targetWebhooks);
        }
    }
    
    console.log(`✅ Mirroring active across ${channelWebhooks.size} channels`);
}

// When the bot is ready
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    console.log(`🎰 Double Account Detection Bot`);
    
    // Register slash commands
    await registerCommands();
    
    // Initialize linkedChannels if not exists
    if (!config.linkedChannels) {
        config.linkedChannels = [];
        saveConfig();
    }
    
    const linkedCount = config.linkedChannels.length;
    console.log(`📡 ${linkedCount} channel(s) in sync network`);
    
    // Log linked channels
    if (linkedCount > 0) {
        console.log('📋 Linked channels:');
        for (const channelId of config.linkedChannels) {
            try {
                const ch = await client.channels.fetch(channelId);
                console.log(`   - #${ch.name} (${ch.guild.name})`);
            } catch (e) {
                console.log(`   - ${channelId} (could not fetch - removing)`);
                // Remove invalid channels
                config.linkedChannels = config.linkedChannels.filter(id => id !== channelId);
                saveConfig();
            }
        }
    }
    
    await initializeWebhooks();
    console.log('✅ Bot is ready!');
    console.log('💡 Use /mirror link in each server channel to add it to the network');
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'mirror') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'link') {
            const channelId = interaction.channelId;
            const channel = interaction.channel;
            
            // Initialize if needed
            if (!config.linkedChannels) {
                config.linkedChannels = [];
            }
            
            // Check if already linked
            if (config.linkedChannels.includes(channelId)) {
                return interaction.reply({
                    content: '⚠️ This channel is already linked to the sync network!',
                    ephemeral: true
                });
            }
            
            // Add channel
            config.linkedChannels.push(channelId);
            saveConfig();
            await initializeWebhooks();
            
            const totalChannels = config.linkedChannels.length;
            const embed = new EmbedBuilder()
                .setTitle('🔗 Channel Linked!')
                .setColor(0x00ff00)
                .setDescription(`**#${channel.name}** is now part of the sync network`)
                .addFields(
                    { name: 'Server', value: interaction.guild.name, inline: true },
                    { name: 'Total Channels', value: totalChannels.toString(), inline: true }
                )
                .setFooter({ text: totalChannels >= 2 ? '✅ Messages will now sync across all linked channels!' : '⚠️ Link at least one more channel to start syncing' });
            
            return interaction.reply({ embeds: [embed] });
        }
        
        if (subcommand === 'unlink') {
            const channelId = interaction.channelId;
            
            if (!config.linkedChannels || !config.linkedChannels.includes(channelId)) {
                return interaction.reply({
                    content: '⚠️ This channel is not linked to the sync network.',
                    ephemeral: true
                });
            }
            
            // Remove channel
            config.linkedChannels = config.linkedChannels.filter(id => id !== channelId);
            saveConfig();
            await initializeWebhooks();
            
            const embed = new EmbedBuilder()
                .setTitle('🔓 Channel Unlinked!')
                .setColor(0xff6600)
                .setDescription('This channel has been removed from the sync network');
            
            return interaction.reply({ embeds: [embed] });
        }
        
        if (subcommand === 'list') {
            const linkedChannels = config.linkedChannels || [];
            
            if (linkedChannels.length === 0) {
                return interaction.reply({
                    content: '📭 No channels linked yet. Use `/mirror link` in each server to add channels!',
                    ephemeral: true
                });
            }
            
            const channelList = [];
            for (const chId of linkedChannels) {
                try {
                    const ch = await client.channels.fetch(chId);
                    const isCurrent = chId === interaction.channelId ? ' 👈 (this channel)' : '';
                    channelList.push(`• #${ch.name} - **${ch.guild.name}**${isCurrent}`);
                } catch (e) {
                    channelList.push(`• Unknown channel (${chId})`);
                }
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🌐 Sync Network')
                .setColor(0x0099ff)
                .setDescription(`**${linkedChannels.length} channel(s)** linked for double account detection`)
                .addFields({
                    name: 'Linked Channels',
                    value: channelList.join('\n'),
                    inline: false
                })
                .setFooter({ text: 'Messages sent in any channel will appear in all others' });
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'status') {
            const channelId = interaction.channelId;
            const isLinked = config.linkedChannels && config.linkedChannels.includes(channelId);
            
            if (!isLinked) {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Channel Status')
                    .setColor(0x888888)
                    .setDescription('This channel is **not linked** to the sync network.')
                    .setFooter({ text: 'Use /mirror link to add it' });
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            const totalChannels = config.linkedChannels.length;
            const embed = new EmbedBuilder()
                .setTitle('📊 Channel Status')
                .setColor(0x00ff00)
                .setDescription('This channel is **linked** to the sync network!')
                .addFields(
                    { name: 'Status', value: totalChannels >= 2 ? '✅ Active' : '⚠️ Waiting for more channels', inline: true },
                    { name: 'Network Size', value: `${totalChannels} channel(s)`, inline: true }
                )
                .setFooter({ text: 'Messages here will sync to all other linked channels' });
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// Listen for messages
client.on('messageCreate', async (message) => {
    // Ignore bot messages and system messages
    if (message.author.bot || message.system) return;

    // Check if this channel is being mirrored
    const targetWebhooks = webhooks.get(message.channel.id);
    if (!targetWebhooks || targetWebhooks.length === 0) return;

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

        // Prepare the message payload
        const payload = {
            content: content || undefined,
            username: `${message.author.displayName} (${message.guild.name})`,
            avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            files: files.length > 0 ? files : undefined,
            embeds: embeds.length > 0 ? embeds : undefined,
            allowedMentions: { parse: [] }
        };

        // Send to all other channels
        for (const webhook of targetWebhooks) {
            await webhook.send(payload);
        }

        console.log(`📨 Synced message from ${message.author.tag} (${message.guild.name}) to ${targetWebhooks.length} server(s)`);
    } catch (error) {
        console.error('❌ Error syncing message:', error);
    }
});

// Handle errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
