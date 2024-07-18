// control.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { OPENAI_ASSISTANTS, VOICES, LANGUAGES } = require('../sys/config');
const logger = require('../sys/logger');
const {  getSelectedAssistantId,setSelectedAssistantId, getSelectedVoice} = require('../utils/helpers');
const path = require('path');





function createControlPanel() {
  logger.info('🥝 Creating control panel with combined image');

  // Use CloudFront URL for the combined image
  const imageUrl = 'https://deebot.s3.af-south-1.amazonaws.com/optimized_combined.webp';

  // Create an embed with the combined image
  const embed = new EmbedBuilder()
    .setTitle('Select an assistant')
    //.setDescription('Select an assistant')
    .setColor(0x00AE86)
    .setImage(imageUrl)
    // .setAuthor({ name: 'Nameless', iconURL: 'https://deebot.s3.af-south-1.amazonaws.com/optimized_dimi.webp', url: 'https://cityzen.co.za' });

  // Create buttons for each assistant
  const imageButtonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('select_ricktea')
        .setLabel('\u200B 🫖 Select Ricktea')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('select_dimi')
        .setLabel('\u200B 🎮 Select Dimi')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('select_jason')
        .setLabel('🦢 Select Jason')
        .setStyle(ButtonStyle.Primary)
    );

  return {
    components: [imageButtonRow],
    embeds: [embed]
  };
}

function createAssistantPanel(assistantId) {
  logger.info(`Creating assistant panel for assistant ID: ${assistantId}`);

  setSelectedAssistantId(assistantId);
  const assistantKey = Object.keys(OPENAI_ASSISTANTS).find(key => OPENAI_ASSISTANTS[key].id === assistantId);

  if (!assistantKey) {
    logger.error(`⛑️  Invalid assistant ID: ${assistantId}`);
    throw new Error(`Invalid assistant ID: ${assistantId}`);
  }

  const friendlyName = OPENAI_ASSISTANTS[assistantKey].friendlyName;
  let imageUrl;
  switch (friendlyName) {
    case 'RickTea':
      imageUrl = 'https://deebot.s3.af-south-1.amazonaws.com/optimized_ricktea.webp';
      break;
    case 'Dimi':
      imageUrl = 'https://deebot.s3.af-south-1.amazonaws.com/optimized_dimi.webp';
      break;
    case 'Jason':
      imageUrl = 'https://deebot.s3.af-south-1.amazonaws.com/optimized_jason.webp';
      break;
    default:
      imageUrl = 'https://deebot.s3.af-south-1.amazonaws.com/optimized_combined.webp';
      break;
  }

  logger.info(`🥝 Creating assistant panel for ${friendlyName} with image URL: ${imageUrl}`);

  const embed = new EmbedBuilder()
    .setTitle(`You are now talking to ${friendlyName}`)
    //.setDescription(`You are now interacting with ${friendlyName}`)
    .setImage(imageUrl)
    .setColor(0x00AE86);

  const voiceSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_voice_${assistantId}`)
        .setPlaceholder(`Voice - ${getSelectedVoice()}`)
        .addOptions(
          Object.keys(VOICES.OPTIONS).map(voice => ({
            label: VOICES.OPTIONS[voice],
            value: voice
          }))
        )
    );

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ask_${assistantId}`)
        .setLabel(`Ask ${friendlyName}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`close_${assistantId}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    );

  return {
    embeds: [embed],
    components: [voiceSelectRow, buttonRow]
  };
}

async function updateAssistantPanel(interaction, assistantPanel) {
  try {
    const currentMessage = await interaction.channel.messages.fetch(interaction.message.id);

    // Filter out existing assistant panel components
    const newComponents = currentMessage.components.filter(row => row.components.every(comp => !comp.customId.startsWith('select_voice_') && !comp.customId.startsWith('ask_') && !comp.customId.startsWith('close_')));

    // Add new assistant panel components
    newComponents.push(...assistantPanel.components);

    await currentMessage.edit({
      embeds: [currentMessage.embeds[0], ...assistantPanel.embeds],
      components: newComponents
    });

    await interaction.update({});
  } catch (error) {
    logger.error('⛑️  Error updating assistant panel:', error);
    throw error;
  }
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

module.exports = { updateAssistantPanel, createControlPanel,createAssistantPanel,  createAskRickTeaModal };
