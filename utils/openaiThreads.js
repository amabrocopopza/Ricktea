const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { PassThrough } = require('stream');
const { OPENAI_ASSISTANTS } = require('../sys/config');
const { getThreadId, saveThreadId } = require('./database');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const logger = require('../sys/logger');

async function getOrCreateThreadId(user_id) {
  let thread_id = await getThreadId(user_id);
  if (!thread_id) {
    thread_id = await createThread();
    if (thread_id) {
      await saveThreadId(user_id, thread_id);
    }
  }
  return thread_id;
}

async function createThread() {
  try {
    const response = await openai.beta.threads.create({ messages: [] });
    logger.info("🥝 Successfully created a new thread with OpenAI.");

    if (response && response.id) {
      return response.id;
    } else {
      logger.error("⛑️ Invalid response structure:", response);
      return null;
    }
  } catch (e) {
    logger.error(`⛑️ Error creating thread with OpenAI: ${e}`);
    return null;
  }
}

async function addMessageToThread(threadId, role, content) {
  try {
    const response = await openai.beta.threads.messages.create(threadId, {
      role: role,
      content: content,
    });

    if (response && response.id) {
      logger.info(`🥝 Successfully added message to thread ${threadId}`);
      return response;
    } else {
      logger.error("⛑️ Invalid response structure:", response);
      return null;
    }
  } catch (e) {
    logger.error(`⛑️ Error adding message to thread ${threadId} with OpenAI: ${e}`);
    return null;
  }
}

async function runAndPollThread(threadId, currentAssistantId, username) {
  logger.info(`🥝 Run started with ${currentAssistantId} for ${username}`);
  
  try {
    let run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: currentAssistantId,
      additional_instructions: `Please address the user as ${username}.`,
    });
    logger.info(`🥝 Initial run completed with status: ${run.status}`);

    while (run.status !== "completed" && run.status !== "failed") {
      run = await openai.beta.threads.runs.poll(threadId, run.id);
    }

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId, { limit: 1, order: 'desc' });
      if (messages.data.length > 0) {
        const latestMessage = messages.data[0];
        logger.info("🥝 Retrieved latest message from thread.");
        return latestMessage.content[0].text.value;
      } else {
        logger.warn("⚠️ No messages found in the thread.");
        return null;
      }
    } else {
      logger.error("⛑️ Initial run failed.");
      return null;
    }
  } catch (e) {
    logger.error(`⛑️ Error running and polling thread with OpenAI: ${e}`);
    return null;
  }
}

async function textToSpeech(responseText, selectedVoice) {
  try {
    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: responseText,
    });

    logger.info("🥝 TTS response received from OpenAI.");
    return speechResponse.body;
  } catch (error) {
    logger.error(`⛑️ Error generating speech: ${error}`);
    throw error;
  }
}

async function streamThreadRun(threadId, currentAssistantId, username) {
  try {
    const run = openai.beta.threads.runs.stream(threadId, {
      assistant_id: currentAssistantId,
      stream: true,
      additional_instructions: `Please address the user as ${username}.`,
    });

    const textStream = new PassThrough();

    run.on('textDelta', (delta, snapshot) => {
      const chunk = snapshot.content?.[0];
      if (chunk && 'text' in chunk && chunk.text.value) {
        textStream.write(chunk.text.value);
      }
    });

    run.on('end', () => {
      textStream.end();
      logger.info("🥝 Text stream ended.");
    });

    return textStream;
  } catch (error) {
    logger.error(`⛑️ Error creating text stream: ${error.message}`);
    throw new Error('Error creating text stream');
  }
}

module.exports = { streamThreadRun, textToSpeech, createThread, addMessageToThread, getOrCreateThreadId, runAndPollThread };
