# Folder Overview

Processing stage components that execute in sequence during the data processing workflow. Each stage handles a specific aspect of data processing.

## Files

- `competitionProcessor.js`: Stage 1 - Competition processing
- `teamProcessor.js`: Stage 2 - Team processing
- `gameProcessor.js`: Stage 3 - Game processing
- `fixtureValidationProcessor.js`: Stage 4 - Fixture validation processing
- `fixtureCleanupProcessor.js`: Stage 5 - Fixture cleanup and deletion processing
- `trackingProcessor.js`: Stage 6 - Tracking and metrics processing

## Processing Order

1. **Competitions** → Process and assign competitions
2. **Teams** → Process and assign teams
3. **Games** → Process and assign game data
4. **Fixture Validation** → Validate fixture URLs and status
5. **Fixture Cleanup** → Compare and delete invalid/missing fixtures
6. **Tracking** → Record processing metrics and completion status

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: `stageOrchestrator.js` (coordinates execution)
- Key dependencies: `processors` module, `services` module

## Dependencies

- Internal: `processors` (competitionProcessor, teamProcessor, gameDataProcessor, fixtureValidationProcessor), `services` (fixtureComparisonService, fixtureDeletionService, CRUDoperations, processingTracker), `utils` (memoryTracker), `puppeteer` (memoryUtils)
- External: Logger utility from `src/utils/logger`

