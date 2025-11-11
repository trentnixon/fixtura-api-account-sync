const logger = require("../../src/utils/logger");
const CRUDOperations = require("./CRUDoperations");

class ProcessingTracker {
  static instance = null;
  constructor() {
    this.CRUDOperations = new CRUDOperations();
    this.data = {
      competitions: {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsNew: 0,
        errorsDetected: 0,
      },
      teams: {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsNew: 0,
        errorsDetected: 0,
      },
      games: {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsNew: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      "fixture-validation": {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      "fixture-cleanup": {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      totalStages: 5,
      currentStage: null,
      completedStages: [],
      pendingStages: [
        "competitions",
        "teams",
        "games",
        "fixture-validation",
        "fixture-cleanup",
      ],
    };
    if (ProcessingTracker.instance) {
      throw new Error("You can only create one instance of ProcessingTracker!");
    }
    // Initialize your tracking data here
    ProcessingTracker.instance = this;
  }

  resetTracker() {
    this.data = {
      competitions: {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsNew: 0,
        errorsDetected: 0,
      },
      teams: { itemsFound: 0, itemsUpdated: 0, itemsNew: 0, errorsDetected: 0 },
      games: {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsNew: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      "fixture-validation": {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      "fixture-cleanup": {
        itemsFound: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorsDetected: 0,
      },
      totalStages: 5,
      currentStage: null,
      completedStages: [],
      pendingStages: [
        "competitions",
        "teams",
        "games",
        "fixture-validation",
        "fixture-cleanup",
      ],
    };
  }

  itemFound(type, count) {
    if (this.data[type]) {
      this.data[type].itemsFound += Number(count);
      logger.debug(
        `ProcessingTracker items found for ${type}: ${this.data[type].itemsFound}`
      );
    }
  }

  itemUpdated(type) {
    if (this.data[type]) {
      this.data[type].itemsUpdated++;
    }
  }

  itemNew(type) {
    if (this.data[type]) {
      this.data[type].itemsNew++;
    }
  }

  itemDeleted(type) {
    if (this.data[type]) {
      if (!this.data[type].itemsDeleted) {
        this.data[type].itemsDeleted = 0;
      }
      this.data[type].itemsDeleted++;
    }
  }

  errorDetected(type) {
    if (this.data[type]) {
      this.data[type].errorsDetected++;
    }
  }

  updateCount(type, action) {
    this.data[type][action]++;
  }

  addError(type, error) {
    this.data[type].errors++;
    this.data.errors.push({ type, error: error.message });
    // Optionally limit the size of the errors array to conserve memory
  }

  setProcessingTime(type, time) {
    this.data.processingTime[type] = time;
  }

  addLastProcessed(type, identifier) {
    this.data.lastProcessed.push({ type, identifier });
    // Optionally limit the size of the lastProcessed array to conserve memory
  }

  getTracker() {
    logger.debug("Current tracker state", { trackerData: this.data });
    return this.data;
  }
  static getInstance() {
    if (!ProcessingTracker.instance) {
      throw new Error(
        "No instance of ProcessingTracker found. Please initialize it first."
      );
    }
    return ProcessingTracker.instance;
  }

  // Sync Settings

  // Sets the current stage being processed
  async setCurrentStage(stage, collectionID) {
    this.data.currentStage = stage;
    logger.info(`Processing stage set to: ${stage}`, { stage, collectionID });
    await this.updateDatabaseAfterAction(collectionID);
    return true;
  }

  // Marks a stage as completed and updates the database
  async completeStage(stage, collectionID) {
    this.data.completedStages.push(stage);
    const index = this.data.pendingStages.indexOf(stage);
    if (index > -1) {
      this.data.pendingStages.splice(index, 1);
    }
    logger.info(`Stage completed: ${stage}`, { stage, collectionID });
    await this.updateDatabaseAfterAction(collectionID); // Method to update the database
    return true;
  }

  // Call this method after each significant action
  async updateDatabaseAfterAction(collectionID) {
    const processingData = this.getTracker();
    try {
      // Assuming CRUDOperations has a method to update the data collection
      await this.CRUDOperations.updateDataCollection(collectionID, {
        processingTracker: processingData,
      });
      logger.info("Database updated with current sync status.");
      return true;
    } catch (error) {
      logger.error(`Error updating database after action: ${error}`);
    }
  }
}

module.exports = ProcessingTracker;
