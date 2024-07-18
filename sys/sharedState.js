const logger = require('./logger'); // Ensure logging is available
const { VOICES, LANGUAGES, OPENAI_ASSISTANTS } = require('./config');

let controlPanelMessageID = null;
let selectedVoice = VOICES.SELECTED || VOICES.DEFAULT;
let selectedLanguage = LANGUAGES.SELECTED || LANGUAGES.DEFAULT;
let selectedAssistant = OPENAI_ASSISTANTS.SELECTED;

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
  getControlPanelMessageID,
  setControlPanelMessageID,
  getSelectedVoice,
  setSelectedVoice,
  getSelectedLanguage,
  setSelectedLanguage,
  getSelectedAssistantId,
  setSelectedAssistantId,
  getSelectedAssistantKey,
  getSelectedAssistantFriendlyName,
  getSelectedAssistantKeyFriendlyName
};
