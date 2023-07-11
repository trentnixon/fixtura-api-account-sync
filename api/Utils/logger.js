const winston = require("winston");
const { createLogger, format, transports } = winston;
const Mail = require("winston-mail").Mail;
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
    new transports.Console({
      level: "debug",
      format: format.combine(
        format.colorize(),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    }),
    new Mail({
      level: "critical",
      to: "trentnixon@gmail.com",
      from: "accountScrape-error-notify@fixtura.com.au",
      subject: "Fixtura Critical Error Occurred",
      host: "smtp.sendgrid.net",
      port: 587,
      username: "apikey",
      password: process.env.SENDGRID_API_KEY,
      ssl: false,
      formatter: (info) => {
        return `
          Time: ${info.timestamp}
          Level: ${info.level}
          Message: ${info.message}
          
          Additional Information!
          Web Service: Account User Scrape.
          Folder: ScrapeAccountSync
          File:${info.file}
          Function: ${info.function}
          error: ${info.error}
        `;
      },
    }),
  ],
});

module.exports = logger;
