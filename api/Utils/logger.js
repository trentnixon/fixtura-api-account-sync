const winston = require("winston");
const { createLogger, format, transports } = winston;
const SlackTransport = require('./SlackTransport');
const dotenv = require("dotenv");
dotenv.config();

const levels = {
  critical: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4, 
  debug: 5,
  silly: 6,
};

winston.addColors({ 
  critical: "red",
  error: "red",
  warn: "yellow",
  info: "green",
  verbose: "blue",
  debug: "blue",
  silly: "blue",
});

const logger = createLogger({
  levels,
  format: format.combine(
    format.splat(), // Enable metadata
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }), 
    format.json()
  ),
  transports: [
    new transports.File({
      filename: "error.log",
      level: "error",
    }),
    new transports.File({
      filename: "combined.log",
    }),
    new SlackTransport({
      token: process.env.SlackToken,
      channel: '#data-account-error',
      level: 'error', // Only log 'error' level messages
    }),
    new SlackTransport({
      token: process.env.SlackToken,
      channel: '#data-account',
      level: 'warn', // Only log 'error' level messages
    }),
    new transports.Console({
      level: "debug",
      format: format.combine(
        format.colorize(),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    })
  ],
});

module.exports = logger;
