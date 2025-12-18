const logger = require("../../../../src/utils/logger");

/**
 * Processing configuration manager
 * Simple true/false flags for each stage
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
   * Default configuration - all stages enabled
   */
  static DEFAULT_CONFIG = {
    stages: {
      [ProcessingConfig.STAGES.COMPETITIONS]: false,
      [ProcessingConfig.STAGES.TEAMS]: false,
      [ProcessingConfig.STAGES.GAMES]: false,
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
   * Create configuration from environment variables or custom config
   * @param {object} customConfig - Optional custom configuration object
   * @returns {object} Validated configuration object
   */
  static create(customConfig = null) {
    // Start with default config
    const config = ProcessingConfig.deepClone(ProcessingConfig.DEFAULT_CONFIG);

    // Override with environment variables if set
    if (process.env.ENABLE_COMPETITIONS !== undefined) {
      config.stages[ProcessingConfig.STAGES.COMPETITIONS] =
        process.env.ENABLE_COMPETITIONS === "true";
    }
    if (process.env.ENABLE_TEAMS !== undefined) {
      config.stages[ProcessingConfig.STAGES.TEAMS] =
        process.env.ENABLE_TEAMS === "true";
    }
    if (process.env.ENABLE_GAMES !== undefined) {
      config.stages[ProcessingConfig.STAGES.GAMES] =
        process.env.ENABLE_GAMES === "true";
    }
    if (process.env.ENABLE_FIXTURE_VALIDATION !== undefined) {
      config.stages[ProcessingConfig.STAGES.FIXTURE_VALIDATION] =
        process.env.ENABLE_FIXTURE_VALIDATION === "true";
    }
    if (process.env.ENABLE_FIXTURE_CLEANUP !== undefined) {
      config.stages[ProcessingConfig.STAGES.FIXTURE_CLEANUP] =
        process.env.ENABLE_FIXTURE_CLEANUP === "true";
    }
    if (process.env.ENABLE_TRACKING !== undefined) {
      config.stages[ProcessingConfig.STAGES.TRACKING] =
        process.env.ENABLE_TRACKING === "true";
    }

    // Override with custom config if provided
    if (customConfig && typeof customConfig === "object") {
      if (customConfig.stages) {
        Object.keys(customConfig.stages).forEach((stage) => {
          if (config.stages.hasOwnProperty(stage)) {
            config.stages[stage] = customConfig.stages[stage];
          }
        });
      }
      if (customConfig.refreshDataBetweenStages !== undefined) {
        config.refreshDataBetweenStages = customConfig.refreshDataBetweenStages;
      }
      if (customConfig.forceBrowserRestart) {
        config.forceBrowserRestart = {
          ...config.forceBrowserRestart,
          ...customConfig.forceBrowserRestart,
        };
      }
    }

    return ProcessingConfig.validate(config);
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
}

module.exports = ProcessingConfig;
