

const { VOICES, LANGUAGES, OPENAI_ASSISTANTS } = require('../sys/config');
const fs = require('fs');
const logger = require('../sys/logger'); // Ensure logging is available
const path = require('path');

let controlPanelMessageID = null;
let selectedVoice = VOICES.SELECTED || VOICES.DEFAULT;
let selectedLanguage = LANGUAGES.SELECTED || LANGUAGES.DEFAULT;
let selectedAssistant = OPENAI_ASSISTANTS.SELECTED;



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


function getControlPanelMessageID() {
  return controlPanelMessageID;
}

function setControlPanelMessageID(newID) {
  logger.info(`🥝 Control Panel MessageID updated to: ${newID}`);
  controlPanelMessageID = newID;
}

function getSelectedVoice() {
  return selectedVoice;
}

function setSelectedVoice(voice) {
  logger.info(`🥝 Selected voice updated to: ${voice}`);
  selectedVoice = voice;
}

function getSelectedLanguage() {
  return selectedLanguage;
}

function setSelectedLanguage(language) {
  logger.info(`🥝 Selected language updated to: ${language}`);
  selectedLanguage = language;
}

function getSelectedAssistantId() {
  const assistantKey = selectedAssistant;
  if (OPENAI_ASSISTANTS[assistantKey]) {
    return OPENAI_ASSISTANTS[assistantKey].id;
  }
  logger.error(`⛑️  No assistant ID found for key: ${assistantKey}`);
  return null;
}

function setSelectedAssistantId(assistantId) {
  const assistantKey = Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === assistantId);
  if (assistantKey) {
    selectedAssistant = assistantKey;
    logger.info(`🥝 Selected assistant updated to: ${assistantKey}`);
  } else {
    logger.error(`⛑️  Invalid asssssssssssssssistant ID: ${assistantId}`);
  }
}

function getSelectedAssistantKey(assistantId) {
  return Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === assistantId);
}

function getSelectedAssistantKeyFriendlyName(assistantKey) {
  return OPENAI_ASSISTANTS[assistantKey].friendlyName;
}

function getSelectedAssistantFriendlyName() {
  const assistantId = getSelectedAssistantId(); // Get the ID of the selected assistant
  const assistantKey = Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === assistantId);
  
  if (assistantKey && OPENAI_ASSISTANTS[assistantKey]) {
    return OPENAI_ASSISTANTS[assistantKey].friendlyName;
  }
  
  logger.error(`⛑️ Invalid assistant ID: ${assistantId}`);
  return null; // or you can return a default value like 'Unknown Assistant'
}

module.exports = { 
  setAssistantToDefault,
  getRandomLoadingMessage,
  updateControlPanelMessage, 
  getControlPanelMessageID, 
  setControlPanelMessageID, 
  getSelectedVoice, 
  setSelectedVoice, 
  getSelectedLanguage, 
  setSelectedLanguage, 
  getSelectedAssistantId, 
  setSelectedAssistantId, 
  getSelectedAssistantKey, 
  getSelectedAssistantKeyFriendlyName, 
  getSelectedAssistantFriendlyName 
};
