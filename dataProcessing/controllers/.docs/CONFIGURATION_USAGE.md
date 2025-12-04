# Processing Configuration Guide

This guide explains how to use the processing configuration system to control which stages run during data processing.

## Quick Start

### Using Presets

The easiest way to configure processing is to use a preset:

```javascript
const DataController = require("./dataController");
const controller = new DataController(fromRedis);

// Use a preset
await controller.start("quick"); // Quick processing (skip validation/cleanup)
await controller.start("full"); // Full processing (all stages)
await controller.start("validation-only"); // Only validation and cleanup
```

### Available Presets

- **`full`**: All stages enabled - complete data processing pipeline
- **`quick`**: Skip validation and cleanup - faster processing for data updates
- **`validation-only`**: Only validation and cleanup stages - for fixture maintenance
- **`data-only`**: Only data processing stages (competitions, teams, games) - no validation
- **`minimal`**: Minimal processing - only competitions and teams

## Custom Configuration

### Basic Custom Configuration

```javascript
const customConfig = {
  stages: {
    competitions: true,
    teams: true,
    games: true,
    "fixture-validation": false, // Skip validation
    "fixture-cleanup": false, // Skip cleanup
    tracking: true,
  },
};

await controller.start(customConfig);
```

### Advanced Configuration

```javascript
const advancedConfig = {
  stages: {
    competitions: true,
    teams: true,
    games: true,
    "fixture-validation": true,
    "fixture-cleanup": true,
    tracking: true,
  },
  refreshDataBetweenStages: true, // Refresh data between stages
  forceBrowserRestart: {
    afterCompetitions: false,
    afterTeams: false,
    afterGames: true, // Force browser restart after games stage
  },
};

await controller.start(advancedConfig);
```

## Configuration Object Structure

```javascript
{
  stages: {
    competitions: boolean,           // Enable/disable competitions stage
    teams: boolean,                 // Enable/disable teams stage
    games: boolean,                  // Enable/disable games stage
    'fixture-validation': boolean,   // Enable/disable validation stage
    'fixture-cleanup': boolean,      // Enable/disable cleanup stage
    tracking: boolean                // Enable/disable tracking stage
  },
  refreshDataBetweenStages: boolean, // Refresh data between stages (default: true)
  forceBrowserRestart: {
    afterCompetitions: boolean,     // Force browser restart after competitions (default: false)
    afterTeams: boolean,             // Force browser restart after teams (default: false)
    afterGames: boolean             // Force browser restart after games (default: true)
  }
}
```

## Programmatic Access

### Get Available Presets

```javascript
const ProcessingConfig = require("./components/core/processingConfig");

const presets = ProcessingConfig.getAvailablePresets();
// Returns: ['full', 'quick', 'validation-only', 'data-only', 'minimal']
```

### Get Preset Description

```javascript
const description = ProcessingConfig.getPresetDescription("quick");
// Returns: "Skip validation and cleanup - faster processing for data updates"
```

### Check Stage Status

```javascript
const config = ProcessingConfig.create("quick");
const isEnabled = ProcessingConfig.isStageEnabled(
  config,
  ProcessingConfig.STAGES.COMPETITIONS
);
// Returns: true
```

### Get Enabled Stages

```javascript
const config = ProcessingConfig.create("quick");
const enabledStages = ProcessingConfig.getEnabledStages(config);
// Returns: ['competitions', 'teams', 'games', 'tracking']
```

## Validation

The configuration system automatically validates your configuration:

- ✅ Validates stage names
- ✅ Validates boolean values
- ✅ Warns about invalid stage names
- ✅ Warns if cleanup is enabled without validation

### Example: Invalid Configuration

```javascript
try {
  const invalidConfig = {
    stages: {
      competitions: "yes", // Invalid: must be boolean
    },
  };
  ProcessingConfig.create(invalidConfig);
} catch (error) {
  console.error(error.message);
  // "Stage 'competitions' must be a boolean value (true/false)"
}
```

## Use Cases

### 1. Quick Data Update

```javascript
await controller.start("quick");
// Fast processing without validation/cleanup overhead
```

### 2. Fixture Maintenance

```javascript
await controller.start("validation-only");
// Only validate and clean up fixtures
```

### 3. Selective Processing

```javascript
await controller.start({
  stages: {
    competitions: false,
    teams: false,
    games: true, // Only process games
    "fixture-validation": false,
    "fixture-cleanup": false,
    tracking: true,
  },
});
```

### 4. Memory-Optimized Processing

```javascript
await controller.start({
  stages: {
    competitions: true,
    teams: true,
    games: true,
    "fixture-validation": false,
    "fixture-cleanup": false,
    tracking: true,
  },
  refreshDataBetweenStages: true,
  forceBrowserRestart: {
    afterGames: true, // Force restart to free memory
  },
});
```

## Default Configuration

If no configuration is provided, the default configuration is used:

```javascript
await controller.start(); // Uses default (equivalent to 'full' preset)
```

Default configuration:

- All stages enabled
- `refreshDataBetweenStages: true`
- `forceBrowserRestart.afterGames: true`
- `forceBrowserRestart.afterCompetitions: false`
- `forceBrowserRestart.afterTeams: false`

## Notes

- **Tracking Stage**: It's recommended to always enable the tracking stage for metrics
- **Validation Dependency**: Cleanup requires validation results. If cleanup is enabled but validation is disabled, a warning will be logged
- **Stage Order**: Stages always execute in order, regardless of configuration
- **Error Handling**: If a stage fails, processing continues to the next enabled stage
