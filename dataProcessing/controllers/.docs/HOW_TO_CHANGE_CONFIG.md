# How to Change Processing Configuration

This guide shows you all the ways to change the processing configuration in your application.

## Quick Reference

The configuration is passed to the `start()` method when calling the DataController:

```javascript
const dataController = new DataController(fromRedis);
await dataController.start(configOrPreset);
```

## Method 1: Using Presets (Simplest)

Pass a preset name as a string:

```javascript
// In your controller file (e.g., src/controller/controller.js)
const dataController = new DataController(fromRedis.getSync);

// Use a preset
await dataController.start('quick');        // Quick processing
await dataController.start('full');        // Full processing (default)
await dataController.start('validation-only'); // Only validation
```

**Available Presets:**
- `'full'` - All stages enabled
- `'quick'` - Skip validation/cleanup
- `'validation-only'` - Only validation and cleanup
- `'data-only'` - Only competitions, teams, games
- `'minimal'` - Only competitions and teams

## Method 2: Custom Configuration Object

Pass a custom configuration object:

```javascript
const customConfig = {
  stages: {
    competitions: true,
    teams: true,
    games: false,  // Skip games
    'fixture-validation': true,
    'fixture-cleanup': true,
    tracking: true
  }
};

await dataController.start(customConfig);
```

## Method 3: Environment Variables

Load configuration from environment variables:

```javascript
// Load from environment variable
const ProcessingConfig = require('./dataProcessing/controllers/components/core/processingConfig');

// Option 1: Use preset from env
const preset = process.env.PROCESSING_PRESET || 'full';
await dataController.start(preset);

// Option 2: Build config from env
const config = {
  stages: {
    competitions: process.env.ENABLE_COMPETITIONS !== 'false',
    teams: process.env.ENABLE_TEAMS !== 'false',
    games: process.env.ENABLE_GAMES !== 'false',
    'fixture-validation': process.env.ENABLE_VALIDATION === 'true',
    'fixture-cleanup': process.env.ENABLE_CLEANUP === 'true',
    tracking: process.env.ENABLE_TRACKING !== 'false'
  }
};
await dataController.start(config);
```

**Example `.env` file:**
```env
PROCESSING_PRESET=quick
# OR
ENABLE_COMPETITIONS=true
ENABLE_TEAMS=true
ENABLE_GAMES=true
ENABLE_VALIDATION=false
ENABLE_CLEANUP=false
ENABLE_TRACKING=true
```

## Method 4: Configuration File

Create a configuration file:

**`config/processingConfig.js`:**
```javascript
module.exports = {
  // Use preset
  preset: 'quick',

  // OR custom config
  custom: {
    stages: {
      competitions: true,
      teams: true,
      games: true,
      'fixture-validation': false,
      'fixture-cleanup': false,
      tracking: true
    },
    refreshDataBetweenStages: true,
    forceBrowserRestart: {
      afterGames: true
    }
  }
};
```

**Usage:**
```javascript
const config = require('./config/processingConfig');

// Use preset
await dataController.start(config.preset);

// OR use custom
await dataController.start(config.custom);
```

## Method 5: Dynamic Configuration Based on Conditions

Configure based on runtime conditions:

```javascript
function getConfigForAccount(accountType, accountSize) {
  // Large accounts: quick processing
  if (accountSize === 'large') {
    return 'quick';
  }

  // Small accounts: full processing
  if (accountSize === 'small') {
    return 'full';
  }

  // Maintenance mode: validation only
  if (process.env.MAINTENANCE_MODE === 'true') {
    return 'validation-only';
  }

  // Default
  return 'full';
}

const config = getConfigForAccount(accountType, accountSize);
await dataController.start(config);
```

## Method 6: Command Line Arguments

Pass configuration via command line:

```javascript
// Parse command line arguments
const args = process.argv.slice(2);
const presetArg = args.find(arg => arg.startsWith('--preset='));
const preset = presetArg ? presetArg.split('=')[1] : 'full';

await dataController.start(preset);
```

**Usage:**
```bash
node your-script.js --preset=quick
```

## Updating Existing Code

### Current Usage (src/controller/controller.js)

**Before:**
```javascript
const dataController = new DataController(fromRedis.getSync);
await dataController.start();  // Uses default (full)
```

**After (Option 1 - Preset):**
```javascript
const dataController = new DataController(fromRedis.getSync);
const preset = process.env.PROCESSING_PRESET || 'full';
await dataController.start(preset);
```

**After (Option 2 - Custom Config):**
```javascript
const dataController = new DataController(fromRedis.getSync);
const config = {
  stages: {
    competitions: true,
    teams: true,
    games: true,
    'fixture-validation': false,  // Skip validation for faster processing
    'fixture-cleanup': false,
    tracking: true
  }
};
await dataController.start(config);
```

## Examples for Common Scenarios

### Scenario 1: Development/Testing
```javascript
// Skip expensive stages during development
await dataController.start({
  stages: {
    competitions: true,
    teams: true,
    games: false,
    'fixture-validation': false,
    'fixture-cleanup': false,
    tracking: true
  }
});
```

### Scenario 2: Production Quick Updates
```javascript
// Use quick preset for regular updates
await dataController.start('quick');
```

### Scenario 3: Scheduled Maintenance
```javascript
// Only validate and clean fixtures
await dataController.start('validation-only');
```

### Scenario 4: Memory-Constrained Environment
```javascript
// Disable data refresh to save memory
await dataController.start({
  stages: {
    competitions: true,
    teams: true,
    games: true,
    'fixture-validation': false,
    'fixture-cleanup': false,
    tracking: true
  },
  refreshDataBetweenStages: false,  // Don't refresh data
  forceBrowserRestart: {
    afterGames: true  // Force restart to free memory
  }
});
```

## Programmatic Configuration

You can also build configurations programmatically:

```javascript
const ProcessingConfig = require('./dataProcessing/controllers/components/core/processingConfig');

// Start with a preset
const baseConfig = ProcessingConfig.create('quick');

// Modify it
baseConfig.stages.games = true;  // Enable games

// Use it
await dataController.start(baseConfig);
```

## Validation

The configuration is automatically validated. Invalid configurations will throw errors:

```javascript
try {
  await dataController.start({
    stages: {
      competitions: 'yes'  // Invalid: must be boolean
    }
  });
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

## Default Behavior

If no configuration is provided, the default (equivalent to `'full'` preset) is used:

```javascript
await dataController.start();  // Uses default: all stages enabled
```

## Best Practices

1. **Use presets for common scenarios** - They're tested and well-defined
2. **Store configuration externally** - Use environment variables or config files for easy changes
3. **Validate in development** - Test your configurations before deploying
4. **Document your choices** - Comment why you're using a specific configuration
5. **Monitor performance** - Track how different configurations affect processing time

## Summary

- **Simplest**: Pass a preset string: `await controller.start('quick')`
- **Flexible**: Pass a config object: `await controller.start({ stages: {...} })`
- **Dynamic**: Load from env vars, files, or build programmatically
- **Default**: No config = full processing (all stages enabled)

