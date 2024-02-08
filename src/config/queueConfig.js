const QUEUE_CONFIG = {
    development: {
      taskRunner: "taskRunnerDev",
      accountInit: "accountInitDev",
    },
    production: {
      taskRunner: "taskRunner",
      accountInit: "accountInit",
    },
  };
  
  module.exports = { QUEUE_CONFIG };
  