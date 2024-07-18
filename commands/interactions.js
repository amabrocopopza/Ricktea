// interactions.js
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const { createAskRickTeaModal, createControlPanel, createAssistantPanel, updateAssistantPanel,  updateControlPanelContent } = require('../utils/control');
const { ReplayLastReply } = require('../utils/audio');
const { handleDisconnect, handleSayCommand, handleJoinCommand } = require('../commands/ricktea');
const { getSelectedVoice, getSelectedLanguage, getSelectedAssistantId, setSelectedLanguage, setSelectedVoice, setSelectedAssistantId, getControlPanelMessageID, setControlPanelMessageID } = require('../sys/sharedState');
const logger = require('../sys/logger');
const sharedState = require('../sys/sharedState'); // Import shared state
const { OPENAI_ASSISTANTS, VOICES, LANGUAGES } = require('../sys/config');

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;
  logger.info(`🥝 Button interaction received: ${customId}`);

  try {
    let assistantPanel;

    if (customId.startsWith('select_')) {
      let assistantId;
      switch (customId) {
        case 'select_ricktea':
          assistantId = OPENAI_ASSISTANTS.Ricktea.id;
          break;
        case 'select_dimi':
          assistantId = OPENAI_ASSISTANTS.Dimi.id;
          break;
        case 'select_jason':
          assistantId = OPENAI_ASSISTANTS.Jason.id;
          break;
        default:
          logger.warn(`⚠️ Unknown button ID: ${customId}`);
          return;
      }

      if (!assistantId) {
        logger.error(`⛑️  Assistant ID is undefined for customId: ${customId}`);
        await interaction.reply({ content: 'There was an error while handling this interaction!', ephemeral: true });
        return;
      }

      logger.info(`🥝 Creating assistant panel for assistant ID: ${assistantId}`);
      assistantPanel = createAssistantPanel(assistantId);

      await updateAssistantPanel(interaction, assistantPanel);

    } else if (customId.startsWith('ask_')) {
      const modal = createAskRickTeaModal();
      await interaction.showModal(modal);
    } else if (customId.startsWith('close_')) {
      await handleDisconnect(interaction); // Call handleDisconnect for close_ interactions
    } else {
      logger.warn(`⚠️ Unknown button ID: ${customId}`);
    }
  } catch (error) {
    logger.error('⛑️  Error handling button interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'There was an error while handling this interaction!', ephemeral: true });
    } else {
      await interaction.editReply({ content: 'There was an error while handling this interaction!' });
    }
  }
}

async function handleModalSubmitInteraction(interaction) {
  try {
    if (interaction.customId === 'ask_ricktea_modal') {
      const text = interaction.fields.getTextInputValue('ricktea_question');
      
      // Defer the reply to give time for processing
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false });
      }

      await handleSayCommand(interaction, text, getSelectedLanguage());
      
      // Send the success response after handling the command
      await interaction.editReply({ content: '✌️ Done.', ephemeral: false });
    }
  } catch (error) {
    logger.error('⛑️  Error handling modal submit interaction:', error.message);
    const errorMessage = `⛑️  ${error.message}`;
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    }
  }

  // Optionally wait and delete the reply after a delay
  if (interaction.replied || interaction.deferred) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    await interaction.deleteReply();
  }
}

async function handleCommandInteraction(interaction, client) {
  // Retrieve the command object using the command name from the interaction
  const command = client.commands.get(interaction.commandName);

  // If the command doesn't exist, handle context menu commands
  if (!command) {
    let selectedVoice = getSelectedVoice();
    let selectedLanguage = getSelectedLanguage();
    let selectedAssistant = getSelectedAssistantId();

    if (interaction.commandName === 'Summon Ricktea') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply({ content: '⛑️  You need to be in a voice channel to use this ⛑️.', ephemeral: true });
        await new Promise(resolve => setTimeout(resolve, 10000));
        await interaction.deleteReply();
        return;
      }

      // Defer the reply to give time for processing
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false });
      }

      try {
        await handleJoinCommand(interaction, false);
      } catch (error) {
        logger.error('⛑️  Error executing join command:', error);
        await interaction.editReply({ content: `There was an error while executing this command: ${error.message}` });
      }

    } else if (interaction.commandName === 'Ask Ricktea') {
      const modal = createAskRickTeaModal();
      await interaction.showModal(modal);
    } else {
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
    return;
  }

  // Handle the command if it exists
  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`⛑️  Error executing command ${interaction.commandName}:`, error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
}


async function handleStringSelectMenuInteraction(interaction) {
  const { customId, values } = interaction;
  logger.info(`🥝 Select menu interaction received: ${customId}`);

  try {
    let updateMessage = true;
    let newComponents, newEmbeds, newFiles;

    switch (customId) {
      case 'select_language':
        setSelectedLanguage(values[0]);
        logger.info(`🥝 Selected language: ${values[0]}`);
        break;
      case 'select_voice':
        setSelectedVoice(values[0]);
        logger.info(`🥝 Selected voice: ${values[0]}`);
        break;
      case 'select_assistant':
        setSelectedAssistantId(values[0]);
        logger.info(`🥝 Selected assistant: ${values[0]}`);
        const controlPanel = createControlPanel(); // Create updated control panel
        newComponents = controlPanel.components;
        newEmbeds = controlPanel.embeds;
        newFiles = controlPanel.files;
        break;
      default:
        updateMessage = false;
        break;
    }

    if (updateMessage) {
      if (!newComponents) {
        const controlPanel = createControlPanel(); // Create updated control panel
        newComponents = controlPanel.components;
      }
      await updateControlPanelContent(interaction, newComponents, newEmbeds, newFiles);
      await interaction.update({});
    }
  } catch (error) {
    logger.error('⛑️  Error handling select menu interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'There was an error while handling this interaction!', ephemeral: true });
    } else {
      await interaction.editReply({ content: 'There was an error while handling this interaction!' });
    }
  }
}

module.exports = {
  handleButtonInteraction,
  handleModalSubmitInteraction,
  handleCommandInteraction,
  handleStringSelectMenuInteraction,
};
