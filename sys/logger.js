//discord-bot-node-js\sys\logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

// Define the log file path
const logFilePath = path.join(__dirname, '..', 'sys', 'bot.log');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logFilePath })
  ]
});

module.exports = logger;