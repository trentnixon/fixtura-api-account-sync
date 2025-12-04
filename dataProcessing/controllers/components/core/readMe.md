# Folder Overview

Core utility components that provide foundational services used across all processing stages.

## Files

- `browserManager.js`: Browser restart logic for memory optimization between processing stages
- `dataSyncOperations.js`: Data synchronization operations (reSyncData, reSyncDataDirect, updateAccountOnly)
- `processingConfig.js`: Processing configuration manager with presets and validation

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: `stageOrchestrator.js`, `dataController.js`
- Key dependencies: `puppeteer` module, `services` module

## Dependencies

- Internal: `puppeteer` (PuppeteerManager), `services` (dataService), `utils` (errorHandler)
- External: Logger utility from `src/utils/logger`

## Configuration Usage

The `processingConfig.js` module provides:

- **Presets**: `full`, `quick`, `validation-only`, `data-only`, `minimal`
- **Custom Configuration**: Enable/disable individual stages
- **Validation**: Automatic configuration validation

Example:

```javascript
const ProcessingConfig = require("./core/processingConfig");

// Use a preset
const config = ProcessingConfig.create("quick");

// Or custom configuration
const customConfig = ProcessingConfig.create({
  stages: {
    competitions: true,
    teams: true,
    games: false,
    "fixture-validation": true,
    "fixture-cleanup": true,
    tracking: true,
  },
});
```
