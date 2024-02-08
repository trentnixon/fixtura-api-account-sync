const logger = require("../../src/utils/logger");
const CRUDOperations = require("./CRUDOperations");

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
        errorsDetected: 0,
      },
      totalStages: 3,
      currentStage: null,
      completedStages: [],
      pendingStages: ["competitions", "teams", "games"],
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
      games: { itemsFound: 0, itemsUpdated: 0, itemsNew: 0, errorsDetected: 0 },
      totalStages: 3,
      currentStage: null,
      completedStages: [],
      pendingStages: ["competitions", "teams", "games"],
    };
  }

  itemFound(type, count) {
    if (this.data[type]) {
      this.data[type].itemsFound += Number(count);
      console.log(
        `ProcessingTracker Items found for ${type}: ${this.data[type].itemsFound}`
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
    console.log("Current tracker state:", this.data);
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
    console.log(`Current processing stage: ${stage}`);
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
    console.log(`Completed stage: ${stage}`);
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
