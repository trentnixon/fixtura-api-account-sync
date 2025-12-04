const logger = require("../../../../src/utils/logger");

/**
 * Processing configuration manager
 * Handles stage enable/disable, presets, and validation
 */
class ProcessingConfig {
  /**
   * Available processing stages
   */
  static STAGES = {
    COMPETITIONS: "competitions",
    TEAMS: "teams",
    GAMES: "games",
    FIXTURE_VALIDATION: "fixture-validation",
    FIXTURE_CLEANUP: "fixture-cleanup",
    TRACKING: "tracking",
  };

  /**
   * Processing presets
   */
  static PRESETS = {
    FULL: "full", // All stages enabled
    QUICK: "quick", // Skip validation and cleanup
    VALIDATION_ONLY: "validation-only", // Only validation and cleanup stages
    DATA_ONLY: "data-only", // Only competitions, teams, games (no validation/cleanup)
    MINIMAL: "minimal", // Only competitions and teams
  };

  /**
   * Default configuration
   */
  static DEFAULT_CONFIG = {
    stages: {
      [ProcessingConfig.STAGES.COMPETITIONS]: true,
      [ProcessingConfig.STAGES.TEAMS]: true,
      [ProcessingConfig.STAGES.GAMES]: true,
      [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: true,
      [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: true,
      [ProcessingConfig.STAGES.TRACKING]: true,
    },
    refreshDataBetweenStages: true,
    forceBrowserRestart: {
      afterGames: true,
      afterCompetitions: false,
      afterTeams: false,
    },
  };

  /**
   * Preset configurations
   */
  static PRESET_CONFIGS = {
    [ProcessingConfig.PRESETS.FULL]: {
      stages: {
        [ProcessingConfig.STAGES.COMPETITIONS]: true,
        [ProcessingConfig.STAGES.TEAMS]: true,
        [ProcessingConfig.STAGES.GAMES]: true,
        [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: true,
        [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: true,
        [ProcessingConfig.STAGES.TRACKING]: true,
      },
      refreshDataBetweenStages: true,
      forceBrowserRestart: {
        afterGames: true,
        afterCompetitions: false,
        afterTeams: false,
      },
    },
    [ProcessingConfig.PRESETS.QUICK]: {
      stages: {
        [ProcessingConfig.STAGES.COMPETITIONS]: true,
        [ProcessingConfig.STAGES.TEAMS]: true,
        [ProcessingConfig.STAGES.GAMES]: true,
        [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: false,
        [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: false,
        [ProcessingConfig.STAGES.TRACKING]: true,
      },
      refreshDataBetweenStages: true,
      forceBrowserRestart: {
        afterGames: true,
        afterCompetitions: false,
        afterTeams: false,
      },
    },
    [ProcessingConfig.PRESETS.VALIDATION_ONLY]: {
      stages: {
        [ProcessingConfig.STAGES.COMPETITIONS]: false,
        [ProcessingConfig.STAGES.TEAMS]: false,
        [ProcessingConfig.STAGES.GAMES]: false,
        [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: true,
        [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: true,
        [ProcessingConfig.STAGES.TRACKING]: true,
      },
      refreshDataBetweenStages: false,
      forceBrowserRestart: {
        afterGames: false,
        afterCompetitions: false,
        afterTeams: false,
      },
    },
    [ProcessingConfig.PRESETS.DATA_ONLY]: {
      stages: {
        [ProcessingConfig.STAGES.COMPETITIONS]: true,
        [ProcessingConfig.STAGES.TEAMS]: true,
        [ProcessingConfig.STAGES.GAMES]: true,
        [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: false,
        [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: false,
        [ProcessingConfig.STAGES.TRACKING]: true,
      },
      refreshDataBetweenStages: true,
      forceBrowserRestart: {
        afterGames: true,
        afterCompetitions: false,
        afterTeams: false,
      },
    },
    [ProcessingConfig.PRESETS.MINIMAL]: {
      stages: {
        [ProcessingConfig.STAGES.COMPETITIONS]: true,
        [ProcessingConfig.STAGES.TEAMS]: true,
        [ProcessingConfig.STAGES.GAMES]: false,
        [ProcessingConfig.STAGES.FIXTURE_VALIDATION]: false,
        [ProcessingConfig.STAGES.FIXTURE_CLEANUP]: false,
        [ProcessingConfig.STAGES.TRACKING]: true,
      },
      refreshDataBetweenStages: true,
      forceBrowserRestart: {
        afterGames: false,
        afterCompetitions: false,
        afterTeams: false,
      },
    },
  };

  /**
   * Create configuration from preset or custom config
   * @param {string|object} presetOrConfig - Preset name or custom configuration object
   * @returns {object} Validated configuration object
   */
  static create(presetOrConfig) {
    if (typeof presetOrConfig === "string") {
      // Preset name provided
      if (!ProcessingConfig.PRESET_CONFIGS[presetOrConfig]) {
        throw new Error(
          `Invalid preset: ${presetOrConfig}. Available presets: ${Object.keys(
            ProcessingConfig.PRESET_CONFIGS
          ).join(", ")}`
        );
      }
      const config = ProcessingConfig.deepClone(
        ProcessingConfig.PRESET_CONFIGS[presetOrConfig]
      );
      return ProcessingConfig.validate(config);
    } else if (typeof presetOrConfig === "object" && presetOrConfig !== null) {
      // Custom configuration provided
      const config = ProcessingConfig.mergeWithDefault(presetOrConfig);
      return ProcessingConfig.validate(config);
    } else {
      // Use default
      return ProcessingConfig.deepClone(ProcessingConfig.DEFAULT_CONFIG);
    }
  }

  /**
   * Merge custom config with default config
   * @param {object} customConfig - Custom configuration to merge
   * @returns {object} Merged configuration
   */
  static mergeWithDefault(customConfig) {
    const merged = ProcessingConfig.deepClone(ProcessingConfig.DEFAULT_CONFIG);

    // Merge stages
    if (customConfig.stages) {
      Object.keys(customConfig.stages).forEach((stage) => {
        if (merged.stages.hasOwnProperty(stage)) {
          merged.stages[stage] = customConfig.stages[stage];
        }
      });
    }

    // Merge refreshDataBetweenStages
    if (customConfig.refreshDataBetweenStages !== undefined) {
      merged.refreshDataBetweenStages = customConfig.refreshDataBetweenStages;
    }

    // Merge forceBrowserRestart
    if (customConfig.forceBrowserRestart) {
      merged.forceBrowserRestart = {
        ...merged.forceBrowserRestart,
        ...customConfig.forceBrowserRestart,
      };
    }

    return merged;
  }

  /**
   * Validate configuration object
   * @param {object} config - Configuration to validate
   * @returns {object} Validated configuration
   * @throws {Error} If configuration is invalid
   */
  static validate(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Configuration must be an object");
    }

    // Validate stages
    if (!config.stages || typeof config.stages !== "object") {
      throw new Error("Configuration must have a 'stages' object");
    }

    // Validate each stage is a boolean
    Object.keys(config.stages).forEach((stage) => {
      if (!Object.values(ProcessingConfig.STAGES).includes(stage)) {
        logger.warn(
          `[CONFIG] Unknown stage '${stage}' in configuration. Valid stages: ${Object.values(
            ProcessingConfig.STAGES
          ).join(", ")}`
        );
      }
      if (typeof config.stages[stage] !== "boolean") {
        throw new Error(
          `Stage '${stage}' must be a boolean value (true/false)`
        );
      }
    });

    // Ensure all required stages exist
    Object.values(ProcessingConfig.STAGES).forEach((stage) => {
      if (!config.stages.hasOwnProperty(stage)) {
        config.stages[stage] = ProcessingConfig.DEFAULT_CONFIG.stages[stage];
      }
    });

    // Validate refreshDataBetweenStages
    if (
      config.refreshDataBetweenStages !== undefined &&
      typeof config.refreshDataBetweenStages !== "boolean"
    ) {
      throw new Error("'refreshDataBetweenStages' must be a boolean value");
    }

    // Validate forceBrowserRestart
    if (config.forceBrowserRestart) {
      if (typeof config.forceBrowserRestart !== "object") {
        throw new Error("'forceBrowserRestart' must be an object");
      }
      Object.keys(config.forceBrowserRestart).forEach((key) => {
        if (typeof config.forceBrowserRestart[key] !== "boolean") {
          throw new Error(
            `'forceBrowserRestart.${key}' must be a boolean value`
          );
        }
      });
    }

    // Validation warnings
    if (
      config.stages[ProcessingConfig.STAGES.FIXTURE_CLEANUP] &&
      !config.stages[ProcessingConfig.STAGES.FIXTURE_VALIDATION]
    ) {
      logger.warn(
        "[CONFIG] Fixture cleanup is enabled but validation is disabled. Cleanup requires validation results."
      );
    }

    return config;
  }

  /**
   * Check if a stage is enabled
   * @param {object} config - Configuration object
   * @param {string} stage - Stage name
   * @returns {boolean} True if stage is enabled
   */
  static isStageEnabled(config, stage) {
    return config.stages[stage] === true;
  }

  /**
   * Get enabled stages list
   * @param {object} config - Configuration object
   * @returns {Array<string>} List of enabled stage names
   */
  static getEnabledStages(config) {
    return Object.keys(config.stages).filter(
      (stage) => config.stages[stage] === true
    );
  }

  /**
   * Deep clone an object
   * @param {object} obj - Object to clone
   * @returns {object} Cloned object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Get available presets
   * @returns {Array<string>} List of preset names
   */
  static getAvailablePresets() {
    return Object.keys(ProcessingConfig.PRESET_CONFIGS);
  }

  /**
   * Get preset description
   * @param {string} preset - Preset name
   * @returns {string} Description of the preset
   */
  static getPresetDescription(preset) {
    const descriptions = {
      [ProcessingConfig.PRESETS.FULL]:
        "All stages enabled - complete data processing pipeline",
      [ProcessingConfig.PRESETS.QUICK]:
        "Skip validation and cleanup - faster processing for data updates",
      [ProcessingConfig.PRESETS.VALIDATION_ONLY]:
        "Only validation and cleanup stages - for fixture maintenance",
      [ProcessingConfig.PRESETS.DATA_ONLY]:
        "Only data processing stages (competitions, teams, games) - no validation",
      [ProcessingConfig.PRESETS.MINIMAL]:
        "Minimal processing - only competitions and teams",
    };
    return descriptions[preset] || "Unknown preset";
  }
}

module.exports = ProcessingConfig;
