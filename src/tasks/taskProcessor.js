class TaskProcessor {
  async process(job) {
    throw new Error(
      "[TaskProcessor] 'process' method must be implemented in subclass"
    );
  }
}

module.exports = TaskProcessor;
