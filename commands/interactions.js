// interactions.js

const { createAskRickTeaModal, createControlPanel } = require('../utils/control');
const { ReplayLastReply } = require('../utils/audio');
const { handleDisconnect, handleSayCommand, handleJoinCommand } = require('../commands/ricktea');
const { getSelectedVoice, getSelectedLanguage, getSelectedAssistantId, setSelectedLanguage, setSelectedVoice, setSelectedAssistantId, getControlPanelMessageID, setControlPanelMessageID } = require('../sys/sharedState');
const logger = require('../sys/logger');
const sharedState = require('../sys/sharedState'); // Import shared state

async function handleButtonInteraction(interaction) {
  try {
    if (interaction.customId === 'ask_ricktea') {
      const modal = createAskRickTeaModal();
      await interaction.showModal(modal);
    } else if (interaction.customId === 'replay_last_reply') {
      await ReplayLastReply(interaction);
    } else if (interaction.customId === 'close') {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.update({ content: 'The control panel has been closed.', components: [] });
        } else {
          await interaction.editReply({ content: 'The control panel has been closed.', components: [] });
        }
        logger.info('🥝 Close button interaction received');
        await handleDisconnect(interaction);
      } catch (error) {
        logger.error('⛑️  Error handling close interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'There was an error while handling this interaction!', ephemeral: true });
        } else {
          await interaction.editReply({ content: 'There was an error while handling this interaction!' });
        }
      }
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
        await interaction.reply({ content: '⛑️  You need to be in a voice channel to use this ⛑️ .', ephemeral: true });
        await new Promise(resolve => setTimeout(resolve, 10000));
        await interaction.deleteReply();
        return;
      }

      // Defer the reply to give time for processing
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false });
      }

      try {
        await handleJoinCommand(interaction, selectedVoice, selectedLanguage, selectedAssistant, true);
        // await interaction.followUp({ content: 'Joined the voice channel successfully!' });
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

  // Retrieve the currently selected assistant key and its ID from the configuration
  let currentAssistantId = getSelectedAssistantId();
  // Retrieve the selected voice and language from the configuration
  const selectedVoice = getSelectedVoice();
  const selectedLanguage = getSelectedLanguage();

  try {
    // If the interaction has not been deferred or replied to, defer the reply
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false });
    }
    // Execute the command, passing in the interaction and configuration settings
    await command.execute(interaction, currentAssistantId, selectedVoice, selectedLanguage);
  } catch (error) {
    // Log the error
    logger.error('⛑️  Error handling command interaction:', error);
    // If the interaction has not been replied to or deferred, send an error reply
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      // Otherwise, edit the existing reply with the error message
      await interaction.editReply({ content: 'There was an error while executing this command!' });
    }
  }
}

async function handleStringSelectMenuInteraction(interaction) {
  const { customId, values } = interaction;
  logger.info(`🥝 Select menu interaction received: ${customId}`);

  try {
    let updateMessage = true;

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
        break;
      default:
        updateMessage = false;
        break;
    }

    if (updateMessage) {
      const { embeds, components, files } = createControlPanel();

      const controlPanelMessageID = getControlPanelMessageID();
      if (!controlPanelMessageID) {
        throw new Error('Control panel message ID is not set.');
      }

      const controlPanelMessage = await interaction.channel.messages.fetch(controlPanelMessageID);
      await controlPanelMessage.edit({
        content: null, // Clear content to avoid conflicts
        embeds,
        components,
        files
      });

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
