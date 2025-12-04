/**
 * Components index file - exports all controller components
 */
module.exports = {
  BrowserManager: require("./core/browserManager"),
  DataSyncOperations: require("./core/dataSyncOperations"),
  ProcessingConfig: require("./core/processingConfig"),
  CompetitionProcessorComponent: require("./stages/competitionProcessor"),
  TeamProcessorComponent: require("./stages/teamProcessor"),
  GameProcessorComponent: require("./stages/gameProcessor"),
  FixtureValidationProcessorComponent: require("./stages/fixtureValidationProcessor"),
  FixtureCleanupProcessorComponent: require("./stages/fixtureCleanupProcessor"),
  TrackingProcessorComponent: require("./stages/trackingProcessor"),
  StageOrchestrator: require("./stageOrchestrator"),
};
