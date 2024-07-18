const sharedState = require('../sys/sharedState');
const { OPENAI_ASSISTANTS, VOICES } = require('../sys/config');
const fs = require('fs');
const logger = require('../sys/logger'); // Ensure logging is available
const path = require('path');
const { setSelectedAssistantId, getControlPanelMessageID, setControlPanelMessageID,  } = require('../sys/sharedState');


async function updateControlPanelMessage(interaction, newContent) {
  try {
    const controlPanelMessageID = getControlPanelMessageID();
    if (!controlPanelMessageID) {
      throw new Error('Control panel message ID is not set.');
    }

    logger.info(`🥝 Fetching control panel message with ID: ${controlPanelMessageID}`);

    const controlPanelMessage = await interaction.channel.messages.fetch(controlPanelMessageID);

    if (!controlPanelMessage || typeof controlPanelMessage.edit !== 'function') {
      throw new Error('Failed to fetch the control panel message or it is not a valid message object.');
    }

    const updatedMessage = await controlPanelMessage.edit({
      content: newContent,
      components: controlPanelMessage.components,
    });

    setControlPanelMessageID(updatedMessage.id); // Update controlPanelMessageID with the new message ID
    logger.info(`🥝 Control panel message updated successfully with new ID: ${updatedMessage.id}`);
  } catch (error) {
    logger.error(`⛑️ Failed to edit control panel message: ${error.message}`);
    throw error;
  }
}

function setAssistantToDefault() {
  const defaultAssistantKey = OPENAI_ASSISTANTS.DEFAULT;
  const defaultAssistantId = OPENAI_ASSISTANTS[defaultAssistantKey].id;
  setSelectedAssistantId(defaultAssistantId);
  logger.info(`🥝 Assistant set to default: ${defaultAssistantKey}`);
}

function getRandomLoadingMessage() {
  try {
    const data = fs.readFileSync('./sys/loadingMessages.json');
    const messages = JSON.parse(data).messages;
    const randomIndex = Math.floor(Math.random() * messages.length);
    const randomMessage = messages[randomIndex];
    logger.info(`🥝 Random loading message selected: ${randomMessage}`);
    return randomMessage;
  } catch (error) {
    logger.error(`⛑️ Error reading loading messages: ${error.message}`);
    return "Loading..."; // Default message in case of an error
  }
}

module.exports = { setAssistantToDefault, getRandomLoadingMessage, updateControlPanelMessage,   };
