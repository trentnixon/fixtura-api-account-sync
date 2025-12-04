# Folder Overview

This folder contains modular components that break down the `DataController` functionality into smaller, maintainable pieces. Components are organized by their role in the processing workflow.

## Structure

```
components/
├── core/                    # Core utilities used across stages
│   ├── browserManager.js   # Browser restart logic for memory optimization
│   └── dataSyncOperations.js # Data synchronization operations
├── stages/                  # Processing stage components (executed in order)
│   ├── competitionProcessor.js
│   ├── teamProcessor.js
│   ├── gameProcessor.js
│   ├── fixtureValidationProcessor.js
│   ├── fixtureCleanupProcessor.js
│   └── trackingProcessor.js
├── stageOrchestrator.js     # Coordinates all processing stages
├── index.js                 # Barrel export for easier imports
└── readMe.md
```

## Files

### Core Utilities (`core/`)

- `browserManager.js`: Browser restart logic for memory optimization between processing stages
- `dataSyncOperations.js`: Data synchronization operations (reSyncData, reSyncDataDirect, updateAccountOnly)

### Processing Stages (`stages/`)

- `competitionProcessor.js`: Competition processing stage
- `teamProcessor.js`: Team processing stage
- `gameProcessor.js`: Game processing stage
- `fixtureValidationProcessor.js`: Fixture validation processing stage
- `fixtureCleanupProcessor.js`: Fixture cleanup and deletion processing stage
- `trackingProcessor.js`: Tracking and metrics processing stage

### Orchestration

- `stageOrchestrator.js`: Main orchestration component that coordinates all processing stages in sequence

### Utilities

- `index.js`: Barrel export file for easier component imports

## Processing Flow

1. **Core utilities** provide foundational services (browser management, data sync)
2. **Stage processors** execute in sequence: Competitions → Teams → Games → Validation → Cleanup → Tracking
3. **Stage orchestrator** coordinates the entire pipeline, managing stage transitions and data flow

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: `dataController.js` (main controller)
- Key dependencies: `processors` module, `services` module, `puppeteer` module

## Dependencies

- Internal: `processors` (competitionProcessor, teamProcessor, gameDataProcessor, fixtureValidationProcessor), `services` (dataService, fixtureComparisonService, fixtureDeletionService, CRUDoperations, processingTracker), `utils` (errorHandler, memoryTracker), `puppeteer` (PuppeteerManager, memoryUtils)
- External: Logger utility from `src/utils/logger`
