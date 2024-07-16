const { PassThrough } = require('stream');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const logger = require('../sys/logger'); // Ensure logging is available

async function streamToFileAndDiscord(stream, filePath, voiceChannel) {
  return new Promise((resolve, reject) => {
    const passThroughStream = new PassThrough();
    const fileWriteStream = fs.createWriteStream(filePath);

    // Pipe the stream to both the pass-through stream and the file write stream
    stream.pipe(passThroughStream);
    stream.pipe(fileWriteStream).on('error', (error) => {
      logger.error(`⛑️ Error writing to file: ${error.message}`);
      reject(error);
    }).on('finish', () => {
      logger.info('🥝 File saved successfully.');
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    const audioResource = createAudioResource(passThroughStream);

    player.play(audioResource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      logger.info("🥝 Audio finished playing.");
      resolve();
    });

    player.on('error', (error) => {
      logger.error(`⛑️ Error playing audio: ${error.message}`);
      reject(error);
    });
  });
}

async function ReplayLastReply(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
    return;
  }

  const speechFile = path.resolve(__dirname, '../audio_clips/current/say_command_response_audio.opus');

  try {
    await playAudioFile(voiceChannel, speechFile);
    await interaction.reply({ content: 'Replaying the last reply...', ephemeral: true });
  } catch (error) {
    logger.error('⛑️ Error playing audio file:', error);
    await interaction.reply({ content: 'Error playing the audio file.', ephemeral: true });
  }
}

async function playAudioFile(voiceChannel, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Audio file does not exist.');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(filePath);

  player.play(resource);
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    logger.info('🥝 Audio finished playing.');
    connection.destroy();
  });

  player.on('error', (error) => {
    logger.error(`⛑️ Error playing audio: ${error.message}`);
    connection.destroy();
  });
}

module.exports = { streamToFileAndDiscord, playAudioFile, ReplayLastReply };
