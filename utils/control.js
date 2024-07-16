// control.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { OPENAI_ASSISTANTS, VOICES, LANGUAGES } = require('../sys/config');
const logger = require('../sys/logger');
const sharedState = require('../sys/sharedState');
const { getSelectedAssistantId, getSelectedVoice, getSelectedLanguage } = sharedState;
const path = require('path');

function createControlPanel() {
  const selectedAssistant = getSelectedAssistantId();
  const selectedVoice = getSelectedVoice();
  const selectedLanguage = getSelectedLanguage();

  const assistantKey = Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === selectedAssistant);
  const friendlyName = assistantKey ? OPENAI_ASSISTANTS[assistantKey].friendlyName : 'Unknown';

  logger.info(`🥝 Creating control panel with assistant ${selectedAssicd stant}, voice ${selectedVoice}, and language ${selectedLanguage}`);

  // Create an embed with an image
  const embed = new EmbedBuilder()
    .setTitle('Control Panel')
    .setDescription('Ask me something, Dont be scared')
    .setImage('attachment://ricktea.webp') // Use the attachment name
    .setColor(0x00AE86);

  // Create action rows for buttons and select menus
  const controlPanelRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ask_ricktea')
        .setLabel(`Ask ${friendlyName}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('replay_last_reply')
        .setLabel('Replay Last Reply')
        .setStyle(ButtonStyle.Primary)
    );

  const voiceSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_voice')
        .setPlaceholder(`Voice - ${VOICES.OPTIONS[selectedVoice]}`)
        .addOptions(
          Object.keys(VOICES.OPTIONS).map(voice => ({
            label: VOICES.OPTIONS[voice],
            value: voice
          }))
        )
    );

  const assistantSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_assistant')
        .setPlaceholder(`Assistant - ${friendlyName}`)
        .addOptions(
          OPENAI_ASSISTANTS.OPTIONS.map(assistant => ({
            label: OPENAI_ASSISTANTS[assistant].friendlyName,
            value: assistant
          }))
        )
    );

  const closeButtonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('close')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    );

  return {
    embeds: [embed],
    components: [controlPanelRow, voiceSelectRow, assistantSelectRow, closeButtonRow],
    files: [{
      attachment: path.resolve(__dirname, '../sys/ricktea.webp'), // Path to the image
      name: 'ricktea.webp' // Name to reference in the embed
    }]
  };
}



function createAskRickTeaModal() {
  const selectedAssistant = getSelectedAssistantId();
  const assistantKey = Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === selectedAssistant);
  const friendlyName = assistantKey ? OPENAI_ASSISTANTS[assistantKey].friendlyName : 'Unknown';

  logger.info(`🥝 Creating Ask ${friendlyName} modal`);

  const modal = new ModalBuilder()
    .setCustomId('ask_ricktea_modal')
    .setTitle(`Ask ${friendlyName}`);

  const textInput = new TextInputBuilder()
    .setCustomId('ricktea_question')
    .setLabel(`What do you want to ask ${friendlyName}?`)
    .setStyle(TextInputStyle.Paragraph);

  const firstActionRow = new ActionRowBuilder().addComponents(textInput);

  modal.addComponents(firstActionRow);
  return modal;
}

module.exports = { createControlPanel, createAskRickTeaModal };
