const logger = require("../utils/logger");

const isJobInQueue = async (queue, jobId) => {
  const jobs = await queue.getJobs(["waiting", "active"]);
  return jobs.some((job) => job.data.getSync && job.data.getSync.ID === jobId);
};

const addJobToQueue = async (queue, jobData, options = {}) => {
    //console.log(jobData)
  const { ID } = jobData.getSync;
  if (await isJobInQueue(queue, ID)) {
    logger.info(`Job for ID: ${ID} already exists in the queue.`);
    return false;
  }
  await queue.add(jobData, options);
  logger.info(`Job added to queue for ID: ${ID}`);
  return true;
}; 

const getQueueStats = async (queue) => {
  const counts = await queue.getJobCounts();
  logger.info(`Queue stats: ${JSON.stringify(counts)}`);
  return counts;
};

const processWithErrorHandler = async (job, processFunction) => {
  try {
    await processFunction(job);
  } catch (error) {
    logger.error(`Error processing job ${job.id}: ${error.message}`, {
      jobData: job.data,
      error: error,
    });
  }
};

module.exports = {
  isJobInQueue,
  addJobToQueue,
  getQueueStats,
  processWithErrorHandler,
};
