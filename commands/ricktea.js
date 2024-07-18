const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const logger = require('../sys/logger');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const { createControlPanel } = require('../utils/control');
const { setAssistantToDefault, updateControlPanelMessage, getRandomLoadingMessage, getSelectedAssistantFriendlyName, getControlPanelMessageID, setControlPanelMessageID,setSelectedVoice, getSelectedVoice, getSelectedAssistantId,setSelectedLanguage } = require('../utils/helpers');
const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateThreadId, addMessageToThread, runAndPollThread, textToSpeech } = require('../utils/openaiThreads');
const { OPENAI_ASSISTANTS, VOICES, LANGUAGES } = require('../sys/config');
const { streamToFileAndDiscord } = require('../utils/audio');
const openai = new OpenAI(process.env.OPENAI_API_KEY);


let currentAssistantId = getSelectedAssistantId();


async function handleDisconnect(context, type = 'interaction') {
  let channel = context.channel;
  let controlPanelMessageID = getControlPanelMessageID(); // Ensure we are getting the latest message ID

  const connection = getVoiceConnection(channel.guild.id);
  if (connection) {
    connection.destroy();

    // Reset to default values
    setSelectedVoice(VOICES.DEFAULT);
    setSelectedLanguage(LANGUAGES.DEFAULT);
    setAssistantToDefault();

    // Fetch and delete the control panel message
    if (controlPanelMessageID) {
      try {
        const controlPanelMessage = await channel.messages.fetch(controlPanelMessageID);
        if (controlPanelMessage && controlPanelMessage.deletable) {
          await controlPanelMessage.delete();
          setControlPanelMessageID(null); // Reset the control panel message ID
        }
      } catch (error) {
        if (error.code === 10008) {
          logger.error(`⛑️ Failed to delete control panel message: Unknown Message (${controlPanelMessageID})`);
        } else {
          logger.error('⛑️ Failed to delete control panel message:', error);
        }
      }
    }

  }
}

async function handleJoinCommand(interaction, playGreeting = false) {
  try {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: 'You need to be in a voice channel first!',
        ephemeral: true,
      });
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    if (playGreeting) {
      const resource = createAudioResource(path.join(__dirname, '../audio_clips/greetings/greeting.mp3'));
      player.play(resource);
    }

    connection.subscribe(player);

    const { embeds, components, files } = createControlPanel();

    let message;
    if (interaction.replied || interaction.deferred) {
      message = await interaction.editReply({
        content: '',
        embeds,
        components,
        files,
      });
    } else {
      message = await interaction.reply({
        content: '',
        embeds,
        components,
        files,
        fetchReply: true,
      });
    }

    setControlPanelMessageID(message.id);
  } catch (error) {
    logger.error('⛑️  Error in handleJoinCommand:', error);
  }
}

async function handleSayCommand(interaction, text) {
  const userId = getSelectedAssistantFriendlyName();
  const username = interaction.user.username;
  const selectedAssistantId = getSelectedAssistantId(); // Use the new function to get the selected assistant ID
  const selectedVoice = getSelectedVoice(); // Use the new function to get the selected voice
  const threadId = await getOrCreateThreadId(userId);

  if (!threadId) {
    throw new Error('Error creating or retrieving thread.');
  }
  interaction.editReply({ content: getRandomLoadingMessage() });
  const addMessageResult = await addMessageToThread(threadId, 'user', text);
  if (!addMessageResult) {
    throw new Error('Error adding message to the thread.');
  }
  interaction.editReply({ content: getRandomLoadingMessage() });
  const runResponse = await runAndPollThread(threadId, selectedAssistantId, username); // Pass selectedAssistantId
  if (!runResponse) {
    throw new Error('Error running the conversation.');
  }

  const responseText = runResponse.trim();
  logger.info(`🥝 OpenAI Response: ${responseText}`);

  try {
    interaction.editReply({ content: '🗣️ Talking to you!' });
    const stream = await textToSpeech(responseText, selectedVoice);
    const speechFile = path.resolve(__dirname, '../audio_clips/current/say_command_response_audio.opus');
    await streamToFileAndDiscord(stream, speechFile, interaction.member.voice.channel);
    logger.info('🥝 TTS generated and playing in voice channel.');    
  } catch (error) {
    logger.error('⛑️  Error during text-to-speech processing:', error);
    throw new Error('Error generating or playing the audio.');
  }
  try {
    const controlPanelMessageID = getControlPanelMessageID();
    if (controlPanelMessageID) {
      const newContent = ``;
      await updateControlPanelMessage(interaction, newContent);
    } else {
      logger.error('⛑️  Control panel message ID is not set.');
    }
  } catch (error) {
    if (error.code === 10008) {
      logger.error('⛑️  Failed to edit control panel message: Unknown Message');
    } else {
      logger.error('⛑️  Failed to edit control panel message:', error);
    }
    throw new Error('Error editing control panel message.');
  }
}

async function handleCleanCommand(interaction) {
  try {
    const number = interaction.options.getInteger('number');

    if (number <= 0) {
      await interaction.reply({ content: 'Please provide a number greater than 0.', ephemeral: true });
      setTimeout(async () => {
        await interaction.deleteReply();
      }, 5000);
      return;
    }

    let messagesToDelete = number;

    while (messagesToDelete > 0) {
      const limit = Math.min(100, messagesToDelete);
      const fetchedMessages = await interaction.channel.messages.fetch({ limit });
      
      if (fetchedMessages.size === 0) break;

      const deletableMessages = fetchedMessages.filter(msg => msg.deletable && Date.now() - msg.createdTimestamp < 1209600000);

      if (deletableMessages.size > 0) {
        await interaction.channel.bulkDelete(deletableMessages, true);
        messagesToDelete -= deletableMessages.size;
      } else {
        break;
      }
    }

    await interaction.reply({ content: `Successfully deleted ${number - messagesToDelete} messages.`, ephemeral: true });
    setTimeout(async () => {
      await interaction.deleteReply();
    }, 5000);
  } catch (error) {
    console.error('⛑️  Failed to delete messages:', error);
    await interaction.reply({ content: 'Failed to delete messages. Please try again.', ephemeral: true });
    setTimeout(async () => {
      await interaction.deleteReply();
    }, 5000);
  }
}

async function handleDirectMeassages(message) {
  try {
    logger.info("🥝 handleDirectMeassages function invoked.");
    const user_id = message.author.id;
    const selectedAssistantId = getSelectedAssistantId();
    const user_message = message.content;
    const username = message.author.username;
    logger.info(`🥝 User ID: ${user_id}, User Message: ${user_message}`);

    const thread_id = await getOrCreateThreadId(user_id);
    if (!thread_id) {
      logger.error("⛑️  Error creating or retrieving thread.");
      await message.channel.send("Error creating or retrieving thread.");
      return;
    }

    logger.info(`🥝 Thread ID for user ${user_id}: ${thread_id}`);

    const result = await addMessageToThread(thread_id, 'user', user_message);
    if (result) {
      logger.info(`🥝 Successfully added message to thread ${thread_id} for user ${user_id}`);
    } else {
      logger.error(`⛑️  Failed to add message to thread ${thread_id} for user ${user_id}`);
      await message.channel.send("Failed to add message to the thread.");
      return;
    }

    logger.info("🥝 🤔..Thinking..🤔");

    logger.info(`🥝 Using assistant_id: ${currentAssistantId}`);

    const loadingMessage = await message.channel.send("🍵 Brewing your perfect cup of tea...");

    const comicalMessages = [
      "🍵 Stirring in some wisdom...",
      "🍵 Adding a dash of humor...",
      "🍵 Waiting for the tea to steep...",
      "🍵 Almost there, just a moment more...",
    ];

    const run_response = await runAndPollThread(thread_id, currentAssistantId, username);
    logger.info(`🥝 Run response message received: ${run_response}`);

    if (run_response === null) {
      logger.error("⛑️  Run requires further action or there was an error.");
      clearInterval(interval);
      await loadingMessage.edit("🚫 The run requires further action or there was an error.");
      return;
    }

    const interval = setInterval(async () => {
      const comicalMessage = comicalMessages.shift();
      if (comicalMessage) {
        await loadingMessage.edit(comicalMessage);
      } else {
        clearInterval(interval);
      }
    }, 5000);

    clearInterval(interval);
    await loadingMessage.edit(run_response);  // Replace the loading message with the final response
    return run_response;  // Return the final response
  } catch (error) {
    logger.error(`⛑️  Error in handleDirectMeassages function: ${error}`);
    await message.channel.send(`Error processing your request: ${error}`);
    return null;  // Return null in case of an error
  }
}

async function handleCheckPing(interaction) {
  const sent = await interaction.editReply({ content: 'Pinging...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  logger.info(`Roundtrip latency: ${latency}ms`);
  await interaction.editReply(`Roundtrip latency: ${latency}ms`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ricktea')
    .setDescription('Various RickTea commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Manage voice channels')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Action to perform on the voice channel')
            .setRequired(true)
            .addChoices(
              { name: 'join', value: 'join' },
              { name: 'leave', value: 'leave' },
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('say')
        .setDescription('Say something and spill the tea 🍵')
        .addStringOption(option =>
          option
            .setName('text')
            .setDescription('Text to say, as refreshing as a cup of tea')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('notion')
        .setDescription('Send bags to Notion and brew the best ideas')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('notion-history')
        .setDescription('Send history to Notion')
        .addIntegerOption(option =>
          option
            .setName('number')
            .setDescription('Number of history lines to send')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clean')
        .setDescription('Clean the channel')
        .addIntegerOption(option =>
          option
            .setName('number')
            .setDescription('Number of messages to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Check the bot\'s latency')
    ),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'channel') {
      const action = interaction.options.getString('action');
      if (action === 'join') {
        await handleJoinCommand(interaction, false); 
      } else if (action === 'leave') {
        await handleDisconnect(interaction); 
        await interaction.reply({ content: 'Processing your request...', ephemeral: false });
        await interaction.deleteReply();
      }
    } else if (subcommand === 'say') {
      const text = interaction.options.getString('text');
      await handleSayCommand(interaction, text);
      await interaction.editReply({ content: '😁' });
      await new Promise(resolve => setTimeout(resolve, 5000));
      await interaction.deleteReply();
    } else if (subcommand === 'clean') {
      await handleCleanCommand(interaction);
    } else if (subcommand === 'ping') {
      await handleCheckPing(interaction);
    }

  },
  handleJoinCommand,
  handleDisconnect,
  handleSayCommand,
  handleCleanCommand,
  handleDirectMeassages,
  handleCheckPing,
};
