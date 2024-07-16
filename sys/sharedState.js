const logger = require('./logger'); // Ensure logging is available
const { VOICES, LANGUAGES, OPENAI_ASSISTANTS } = require('./config');

let controlPanelMessageID = null;
let selectedVoice = VOICES.SELECTED || VOICES.DEFAULT;
let selectedLanguage = LANGUAGES.SELECTED || LANGUAGES.DEFAULT;
let selectedAssistant = OPENAI_ASSISTANTS.SELECTED || OPENAI_ASSISTANTS.DEFAULT;

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
  return OPENAI_ASSISTANTS[selectedAssistant].id;
}

function setSelectedAssistantId(assistant) {
  logger.info(`🥝 Selected assistant updated to: ${assistant}`);
  selectedAssistant = assistant;
}

module.exports = {
  getControlPanelMessageID,
  setControlPanelMessageID,
  getSelectedVoice,
  setSelectedVoice,
  getSelectedLanguage,
  setSelectedLanguage,
  getSelectedAssistantId,
  setSelectedAssistantId
};
