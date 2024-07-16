// discord-bot-node-js\sys\config.js

const logger = require('./logger'); // Ensure logging is available

const OPENAI_ASSISTANTS = {
  Ricktea: {
    id: process.env.OPENAI_ASSISTANT_ID_RICKTEA || 'asst_jCrgR5TyJefrRW87lCmsySDA',
    friendlyName: 'RickTea'
  },
  Dimi: {
    id: process.env.OPENAI_ASSISTANT_ID_DIMI || 'asst_CRgLdnen02iFj1iKdrKn0r4p',
    friendlyName: 'Dimi'
  },
  Jason: {
    id: process.env.OPENAI_ASSISTANT_ID_JASON || 'asst_q6I5xue8EWQ5low54tehHBhh',
    friendlyName: 'Jason'
  },
  DEFAULT: 'Ricktea',
  OPTIONS: ['Ricktea', 'Dimi', 'Jason'],
  SELECTED: 'Ricktea'
};

const VOICES = {
  DEFAULT: 'onyx',
  OPTIONS: {
    onyx: 'Ricky',
    alloy: 'Alloy',
    echo: 'Echo',
    fable: 'Fable',
    nova: 'Nova',
    shimmer: 'Shimmer'
  },
  SELECTED: 'onyx'
};

const LANGUAGES = {
  DEFAULT: 'en',
  OPTIONS: {
    en: 'English',
    af: 'Afrikaans',
    el: 'Greek',
    it: 'Italian'
  },
  SELECTED: 'en'
};

// Ensure that the selected values are valid
function validateConfig() {
  if (!VOICES.OPTIONS[VOICES.SELECTED]) {
    logger.warn(`⚠️ Selected voice ${VOICES.SELECTED} is not valid. Reverting to default.`);
    VOICES.SELECTED = VOICES.DEFAULT;
  }

  if (!LANGUAGES.OPTIONS[LANGUAGES.SELECTED]) {
    logger.warn(`⚠️ Selected language ${LANGUAGES.SELECTED} is not valid. Reverting to default.`);
    LANGUAGES.SELECTED = LANGUAGES.DEFAULT;
  }

  if (!OPENAI_ASSISTANTS[OPENAI_ASSISTANTS.SELECTED]) {
    logger.warn(`⚠️ Selected assistant ${OPENAI_ASSISTANTS.SELECTED} is not valid. Reverting to default.`);
    OPENAI_ASSISTANTS.SELECTED = OPENAI_ASSISTANTS.DEFAULT;
  }

  logger.info('🥝 Configuration validated successfully.');
}

validateConfig();

module.exports = { VOICES, LANGUAGES, OPENAI_ASSISTANTS };
