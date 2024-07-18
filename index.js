require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./sys/logger');
const sodium = require('libsodium-wrappers');
const commandsPath = path.join(__dirname, 'commands');
const { handleJoinCommand, handleDirectMeassages } = require('./commands/ricktea');
const { VOICES, OPENAI_ASSISTANTS, LANGUAGES } = require('./sys/config');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && file !== 'interactions.js'); // Exclude interactions.js
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { handleButtonInteraction, handleModalSubmitInteraction, handleCommandInteraction, handleStringSelectMenuInteraction } = require('./commands/interactions');
const { setSelectedVoice, setSelectedLanguage, setSelectedAssistantId} = require('./utils/helpers');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID;

(async () => {
  await sodium.ready;
  logger.info("🎧 Sodium initialized");
})();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// Load commands asynchronously to improve startup performance
(async () => {
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
    } else {
      logger.error(`⛑️  Command at ${filePath} is missing a name.`);
    }
  }
})();

const rest = new REST({ version: '10' }).setToken(token);
const commands = client.commands.map(command => command.data.toJSON());

const contextMenuCommands = [
  new ContextMenuCommandBuilder()
    .setName('Summon Ricktea')
    .setType(ApplicationCommandType.User)
    .toJSON(),
  new ContextMenuCommandBuilder()
    .setName('Ask Ricktea')
    .setType(ApplicationCommandType.User)
    .toJSON(),
];

// Use async IIFE to load commands
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [...commands, ...contextMenuCommands] },
    );
    logger.info('🥝 Reloaded bot commands.');
  } catch (error) {
    logger.error(`⛑️  Error reloading bot commands: ${error}`);
  }
})();

client.once('ready', () => {
  logger.info(`🥝 ${client.user.tag} is ready to make some tea! 🧋`);
  client.user.setActivity("a pot of tea 🍵🫖", { type: 'STREAMING', url: 'https://howtomaketea.com' });
  // Ensure initial shared state values are set
  setSelectedVoice(VOICES.SELECTED);
  setSelectedLanguage(LANGUAGES.SELECTED);
  setSelectedAssistantId(OPENAI_ASSISTANTS[OPENAI_ASSISTANTS.DEFAULT].id);


});

client.on('interactionCreate', async interaction => {
  logger.info(`🥝 Received interaction: ${interaction.commandName || interaction.customId} from ${interaction.user.tag}`);
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmitInteraction(interaction);
    } else if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      await handleCommandInteraction(interaction, client);
    } else if (interaction.isStringSelectMenu()) {
      await handleStringSelectMenuInteraction(interaction);
    } else {
      logger.info(`🥝 Unknown interaction: ${interaction.type}`);
    }
  } catch (error) {
    logger.error(`⛑️  Unhandled error: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `⛑️  Error: ${error.message}`, ephemeral: true });
    }
  }
});

client.on('messageCreate', async message => {
  logger.info(`🥝 Message received in channel ${message.channel.type}: ${message.content}`);

  // Handle mentions in guild channels
  if (message.mentions.has(client.user) && message.content.trim() === `<@${client.user.id}>`) {
    if (message.member.voice.channel) {
      logger.info(`🥝 Mentioned in guild channel: ${message.guild.name}, joining voice channel: ${message.member.voice.channel.id}`);
      await handleJoinCommand({
        member: message.member,
        reply: msg => message.channel.send(msg)
      }, true); // Pass true to play greeting
    }
  }
  // Handle direct messages
  else if (message.guildId === null && !message.author.bot) {
    logger.info(`🥝 Processing DM from ${message.author.tag}: ${message.content}`);
    try {
      const result = await handleDirectMeassages(message);
      logger.info(`🥝 handleDirectMeassages result: ${result}`);
    } catch (error) {
      logger.error(`⛑️  Error processing DM: ${error}`);
      await message.channel.send(`⛑️  Error processing your request: ${error}`);
    }
  }
});

// Use process.on to handle proper shutdown
process.on('SIGINT', () => {
  client.destroy();
  logger.info('🥝 Discord client destroyed.');
  process.exit(0);
});

client.login(token);
