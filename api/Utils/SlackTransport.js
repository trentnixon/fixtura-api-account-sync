const { Transport } = require('winston');
const { WebClient } = require('@slack/web-api');

class SlackTransport extends Transport {
  constructor(options) {
    super(options);
    this.slackWebClient = new WebClient(options.token);
    this.channel = options.channel; // Slack channel ID to send log messages
  }

  async log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info); 
    });

    if (info.level === 'error' || info.level === 'warn' ) { // Only send error level logs to Slack
      const message = `[${info.level}]: ${info.message}`;

      // Send the log message to the specified Slack channel
      try {
        await this.slackWebClient.chat.postMessage({
          channel: this.channel,
          text: message
        });
      } catch (error) {
        // Handle errors sending to Slack 
        console.error(error);
      }
    }

    callback();
  }
}

module.exports = SlackTransport;
