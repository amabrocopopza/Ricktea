const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const logger = require('../sys/logger');
const sharedState = require('../sys/sharedState');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const { createControlPanel } = require('../utils/control');
const { updateControlPanelMessage, getRandomLoadingMessage } = require('../utils/helpers');
const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateThreadId, addMessageToThread, runAndPollThread, textToSpeech } = require('../utils/openaiThreads');
const { OPENAI_ASSISTANTS, VOICES, LANGUAGES } = require('../sys/config');
const { getControlPanelMessageID, setControlPanelMessageID, setSelectedAssistantId, setSelectedVoice, getSelectedVoice, getSelectedAssistantId, getSelectedLanguage, setSelectedLanguage } = require('../sys/sharedState');
const { streamToFileAndDiscord } = require('../utils/audio');
const openai = new OpenAI(process.env.OPENAI_API_KEY);

let inactivityTimer;
let currentAssistantId = getSelectedAssistantId();

function handleResetInactivityTimer(voiceChannel) {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    handleDisconnect(voiceChannel);
  }, 300000); // 5 minutes of inactivity
  logger.info('🥝 Inactivity timer reset.');
}

async function handleJoinCommand(interaction, playGreeting = false) {
  if (interaction.member.voice.channel) {
    const voiceChannel = interaction.member.voice.channel;
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

    player.on(AudioPlayerStatus.Idle, () => {
      handleResetInactivityTimer(voiceChannel);
    });

    const { embeds, components, files } = createControlPanel();

    try {
      // Check if the interaction has already been replied to or deferred
      if (!interaction.replied && !interaction.deferred) {
        const message = await interaction.reply({
          content: `**Steeped into the voice channel! 🍵 Choose your brew of action:**`,
          embeds,
          components,
          files,
          fetchReply: true
        });
        setControlPanelMessageID(message.id);
        logger.info(`🥝 Joined voice channel: ${voiceChannel.id} with control panel message ID: ${message.id}`);
      } else {
        // If the interaction is already replied or deferred, edit the reply
        const message = await interaction.editReply({
          content: `**Steeped into the voice channel! 🍵 Choose your brew of action:**`,
          embeds,
          components,
          files
        });
        setControlPanelMessageID(message.id);
        logger.info(`🥝 Joined voice channel: ${voiceChannel.id} with control panel message ID: ${message.id}`);
      }
    } catch (error) {
      logger.error('⛑️  Failed to send initial reply:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Error joining the voice channel!', ephemeral: true });
      }
    }
  } else {
    try {
      await interaction.reply({
        content: 'You need to be in a voice channel first!',
        ephemeral: true,
      });
      logger.warn('⚠️ User not in a voice channel.');
    } catch (error) {
      logger.error('⛑️  Failed to send error reply:', error);
    }
  }
}

async function handleDisconnect(interaction) {
  const connection = getVoiceConnection(interaction.guild.id);
  if (connection) {
    connection.destroy();

    // Fetch and delete the control panel message
    const controlPanelMessageID = getControlPanelMessageID();
    if (controlPanelMessageID) {
      try {
        const controlPanelMessage = await getControlPanelMessageID();
        if (controlPanelMessage && controlPanelMessage.deletable) {
          await controlPanelMessage.delete();
          setControlPanelMessageID(null); // Reset the control panel message ID
          logger.info('🥝 Control panel message deleted successfully.');
        }
      } catch (error) {
        if (error.code === 10008) {
          logger.error('⛑️  Failed to delete control panel message: Unknown Message');
        } else {
          logger.error('⛑️  Failed to delete control panel message:', error);
        }
      }
    }

    // Reset to default values
    setSelectedVoice(VOICES.DEFAULT);
    setSelectedLanguage(LANGUAGES.DEFAULT);
    setSelectedAssistantId(OPENAI_ASSISTANTS.DEFAULT);

    try {
      const goodbyeMessage = await interaction.channel.send('Peace ✌️.');
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (goodbyeMessage.deletable) {
        await goodbyeMessage.delete();
      }
      logger.info('🥝 Disconnected from voice channel and sent goodbye message.');
    } catch (error) {
      logger.error('⛑️  Failed to send or delete goodbye message:', error);
    }
  } else {
    try {
      const notInVoiceMessage = await interaction.channel.send('I am not in a voice channel!');
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (notInVoiceMessage.deletable) {
        await notInVoiceMessage.delete();
      }
      logger.warn('⚠️ Attempted to disconnect, but not in a voice channel.');
    } catch (error) {
      logger.error('⛑️  Failed to send or delete not in voice channel message:', error);
    }
  }
}

async function handleSayCommand(interaction, text) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const selectedAssistantId = getSelectedAssistantId(); // Use the new function to get the selected assistant ID
  const selectedVoice = getSelectedVoice(); // Use the new function to get the selected voice
  const threadId = await getOrCreateThreadId(userId);

  if (!threadId) {
    throw new Error('Error creating or retrieving thread.');
  }
  await interaction.editReply({ content: getRandomLoadingMessage() });
  const addMessageResult = await addMessageToThread(threadId, 'user', text);
  if (!addMessageResult) {
    throw new Error('Error adding message to the thread.');
  }
  await interaction.editReply({ content: getRandomLoadingMessage() });
  const runResponse = await runAndPollThread(threadId, selectedAssistantId, username); // Pass selectedAssistantId
  if (!runResponse) {
    throw new Error('Error running the conversation.');
  }

  const responseText = runResponse.trim();
  logger.info(`🥝 OpenAI Response: ${responseText}`);

  try {
    await interaction.editReply({ content: '🗣️ Talking to you!' });
    const stream = await textToSpeech(responseText, selectedVoice);
    const speechFile = path.resolve(__dirname, '../audio_clips/current/say_command_response_audio.opus');
    await streamToFileAndDiscord(stream, speechFile, interaction.member.voice.channel);
    logger.info('🥝 TTS generated and playing in voice channel.');    
  } catch (error) {
    logger.error('⛑️  Error during text-to-speech processing:', error);
    throw new Error('Error generating or playing the audio.');
  }

  // Update the control panel message
  try {
    const controlPanelMessageID = getControlPanelMessageID();
    if (controlPanelMessageID) {
      const newContent = `**Steeped into the voice channel! 🍵 Choose your brew of action:**\n\n🍵 Your message has been served! Enjoy! 🍵\n\n`;
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
      await new Promise(resolve => setTimeout(resolve, 5000));
      await interaction.deleteReply();
      return;
    }

    const messagesToDelete = [];
    let totalFetched = 0;
    let lastMessageId = null;

    while (messagesToDelete.length < number) {
      const limit = Math.min(100, number - messagesToDelete.length);
      const fetchedMessages = await interaction.channel.messages.fetch({ limit, before: lastMessageId });
      if (fetchedMessages.size === 0) break;

      fetchedMessages.forEach(msg => {
        if (msg.deletable && Date.now() - msg.createdTimestamp < 1209600000) { // 14 days in milliseconds
          messagesToDelete.push(msg.id);
        }
      });

      lastMessageId = fetchedMessages.last().id;
      totalFetched += fetchedMessages.size;
      if (totalFetched >= number) break;
    }

    logger.info(`🥝 Messages to delete: ${messagesToDelete}`);

    for (const msgId of messagesToDelete) {
      const message = await interaction.channel.messages.fetch(msgId);
      if (message.deletable) {
        await message.delete().catch(console.error);
      }
    }

    await interaction.reply({ content: `Successfully deleted ${messagesToDelete.length} messages.`, ephemeral: true });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await interaction.deleteReply();
    logger.info(`🥝 Deleted ${messagesToDelete.length} messages.`);
  } catch (error) {
    logger.error('⛑️  Failed to delete messages:', error);
    await interaction.reply({ content: 'Failed to delete messages. Please try again.', ephemeral: true });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await interaction.deleteReply();
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Check the bot\'s latency')
    ),
  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'channel') {
      if (subcommand === 'join') {
        await handleJoinCommand(interaction, getSelectedVoice(), getSelectedLanguage(), getSelectedAssistantId(), true);
      } else if (subcommand === 'leave') {
        await handleDisconnect(interaction); // Use the updated handleDisconnect function
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
