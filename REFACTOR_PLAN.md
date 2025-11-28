# Proxy Integration Refactor Plan

> **Status:** 📋 Planning Phase
> **Goal:** Clean up and refactor proxy-related code for better maintainability, DRY principles, and consistency

---

## 📋 Overview

This document outlines the refactoring plan for the Decodo proxy integration code. The current implementation works but has several areas that can be improved:

1. **Code Duplication**: Launch arguments duplicated across files
2. **Proxy Parsing**: Verbose parsing logic in environment.js
3. **Logging**: Scattered console.log statements
4. **Configuration**: Proxy config logic duplicated
5. **Launch Options**: Browser launch options duplicated

---

## 🎯 Refactoring Goals

1. **DRY (Don't Repeat Yourself)**: Eliminate code duplication
2. **Single Responsibility**: Each module should have one clear purpose
3. **Maintainability**: Easier to update launch args, proxy logic, etc.
4. **Consistency**: Same behavior across PuppeteerManager and legacy launcher
5. **Testability**: Extract logic into testable utilities

---

## 📁 Files to Refactor

### Primary Files

1. `src/config/environment.js` - Proxy configuration parsing
2. `dataProcessing/puppeteer/PuppeteerManager.js` - Main browser manager
3. `common/dependencies.js` - Legacy browser launcher

### New Files to Create

1. `src/config/proxyConfig.js` - Proxy configuration utilities
2. `dataProcessing/puppeteer/browserConfig.js` - Browser launch configuration
3. `src/utils/configLogger.js` - Centralized configuration logging

---

## 🔧 Refactoring Tasks

### Task 1: Extract Proxy Configuration Logic

**Current Issue:**

- Proxy parsing logic is verbose and embedded in `environment.js`
- Logic is duplicated in `PuppeteerManager` and `dependencies.js`

**Solution:**
Create `src/config/proxyConfig.js` to centralize proxy configuration:

```javascript
/**
 * Proxy Configuration Utilities
 * Handles parsing and validation of Decodo proxy settings
 */

/**
 * Decodo Proxy Configuration
 * Ports range from 10001 to 10100 (100 ports total)
 */
const DECODO_PROXY_CONFIG = {
  host: "dc.decodo.com",
  portRange: {
    start: 10001,
    end: 10100,
  },
};

/**
 * Generate port array from range
 */
const generatePortsFromRange = (start, end) => {
  const ports = [];
  for (let i = start; i <= end; i++) {
    ports.push(i.toString());
  }
  return ports;
};

const buildProxyConfig = (env) => {
  // Allow host override via environment variable, otherwise use config
  const host = env.DECODO_PROXY_HOST || DECODO_PROXY_CONFIG.host;

  // Generate ports from configured range
  const ports = generatePortsFromRange(
    DECODO_PROXY_CONFIG.portRange.start,
    DECODO_PROXY_CONFIG.portRange.end
  );

  // Build server string for display/logging
  const serverDisplay = `${host}:${ports.slice(0, 5).join(",")}... (${
    ports.length
  } ports)`;

  return {
    enabled: env.DECODO_PROXY_ENABLED === "true",
    host,
    ports,
    server: serverDisplay,
    username: env.DECODO_PROXY_USERNAME || "",
    password: env.DECODO_PROXY_PASSWORD || "",
    rotateOnRestart: env.DECODO_ROTATE_ON_RESTART !== "false",
    currentPortIndex: 0,
  };
};

const getProxyServerUrl = (host, port) => {
  if (!host || !port) return null;
  return `http://${host}:${port}`;
};

const isProxyConfigValid = (config) => {
  return config.enabled && config.host && config.ports.length > 0;
};

module.exports = {
  DECODO_PROXY_CONFIG,
  generatePortsFromRange,
  buildProxyConfig,
  getProxyServerUrl,
  isProxyConfigValid,
};
```

**Benefits:**

- ✅ Centralized proxy parsing logic
- ✅ Easier to test
- ✅ Reusable across files
- ✅ Better error handling

---

### Task 2: Extract Browser Launch Configuration

**Current Issue:**

- Launch arguments duplicated in `PuppeteerManager.js` and `dependencies.js`
- Different arguments between files (inconsistency)
- Hard to maintain (need to update in multiple places)

**Solution:**
Create `dataProcessing/puppeteer/browserConfig.js`:

```javascript
/**
 * Browser Launch Configuration
 * Centralized Puppeteer browser launch arguments and options
 */

const getBaseLaunchArgs = () => {
  return [
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-sync",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-blink-features=AutomationControlled",
    "--disable-component-extensions-with-background-pages",
    "--disable-ipc-flooding-protection",
    "--mute-audio",
    "--disable-notifications",
    "--disable-default-apps",
  ];
};

const getLegacyLaunchArgs = () => {
  // Legacy launcher uses more aggressive memory optimizations
  return [
    ...getBaseLaunchArgs(),
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-images",
    "--blink-settings=imagesEnabled=false",
    "--metrics-recording-only",
  ];
};

const getLaunchOptions = (options = {}) => {
  const {
    headless = true,
    proxyServer = null,
    protocolTimeout = 120000,
  } = options;

  const args = getBaseLaunchArgs();

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }

  return {
    headless,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    protocolTimeout,
    args,
  };
};

const getLegacyLaunchOptions = (options = {}) => {
  const { headless = true, proxyServer = null } = options;

  const args = getLegacyLaunchArgs();

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }

  return {
    headless,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    args,
  };
};

module.exports = {
  getBaseLaunchArgs,
  getLegacyLaunchArgs,
  getLaunchOptions,
  getLegacyLaunchOptions,
};
```

**Benefits:**

- ✅ Single source of truth for launch args
- ✅ Consistent configuration
- ✅ Easy to update arguments
- ✅ Clear separation between base and legacy configs

---

### Task 3: Centralize Configuration Logging

**Current Issue:**

- Multiple `console.log` statements scattered in `environment.js`
- Inconsistent logging format
- Hard to disable/enable logging

**Solution:**
Create `src/utils/configLogger.js`:

```javascript
/**
 * Configuration Logger
 * Centralized logging for environment configuration
 */

const logEnvironment = (config) => {
  console.log(`[environment.js] Environment: ${config.environment}`);
  console.log(`[environment.js] API Base URL: ${config.api.baseUrl}`);
  console.log(`[environment.js] API Timeout: ${config.api.timeout}ms`);
  console.log(
    `[environment.js] API Retry Attempts: ${config.api.retryAttempts}`
  );
};

const logAdminConfig = (config) => {
  if (config.accountId) {
    console.log(
      `[environment.js] Admin Account ID: ${config.accountId} (for direct org processing)`
    );
  } else {
    console.log(
      `[environment.js] Admin Account ID: Not set (direct org processing will use null account ID)`
    );
  }
};

const logProxyConfig = (config) => {
  const {
    isProxyConfigValid,
    getProxyConfigDisplay,
  } = require("../config/proxyConfig");

  if (isProxyConfigValid(config)) {
    const display = getProxyConfigDisplay(config);
    console.log(`[environment.js] Decodo Proxy: Enabled (${display})`);
  } else {
    console.log(`[environment.js] Decodo Proxy: Disabled`);
  }
};

const logAllConfig = (envConfig) => {
  logEnvironment(envConfig);
  logAdminConfig(envConfig.admin);
  logProxyConfig(envConfig.proxy);
};

module.exports = {
  logEnvironment,
  logAdminConfig,
  logProxyConfig,
  logAllConfig,
};
```

**Benefits:**

- ✅ Consistent logging format
- ✅ Easy to disable/enable
- ✅ Centralized logging logic
- ✅ Better testability

---

### Task 4: Refactor environment.js

**Current Issues:**

- Verbose proxy parsing inline
- Scattered logging
- Mixed concerns (parsing + logging)

**Refactored Structure:**

```javascript
const dotenv = require("dotenv");
const { buildProxyConfig } = require("./config/proxyConfig");
const { logAllConfig } = require("../utils/configLogger");

// ... existing validation code ...

// API Configuration
const API_CONFIG = {
  baseUrl: process.env.FIXTURA_API || "http://127.0.0.1:1337",
  token: process.env.FIXTURA_TOKEN,
  timeout: parseInt(process.env.API_TIMEOUT) || 30000,
  retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS) || 3,
};

// Admin Account Configuration
const ADMIN_CONFIG = {
  accountId: process.env.ADMIN_ACCOUNT_ID
    ? parseInt(process.env.ADMIN_ACCOUNT_ID, 10)
    : null,
};

// Proxy Configuration (using extracted utility)
const PROXY_CONFIG = buildProxyConfig(process.env);

// Log all configuration
logAllConfig({
  environment: ENVIRONMENT,
  api: API_CONFIG,
  admin: ADMIN_CONFIG,
  proxy: PROXY_CONFIG,
});

module.exports = {
  ENVIRONMENT,
  API_CONFIG,
  ADMIN_CONFIG,
  PROXY_CONFIG,
  isDevelopment: ENVIRONMENT === "development",
  isProduction: ENVIRONMENT === "production",
};
```

**Benefits:**

- ✅ Cleaner, more readable code
- ✅ Separation of concerns
- ✅ Easier to test
- ✅ Reusable proxy parsing

---

### Task 5: Refactor PuppeteerManager.js

**Current Issues:**

- Duplicated launch args
- Inline proxy config logic
- Verbose launch options

**Refactored Structure:**

```javascript
const { getLaunchOptions } = require("./browserConfig");
const {
  isProxyConfigValid,
  getProxyServerUrl,
} = require("../../src/config/proxyConfig");

class PuppeteerManager {
  // ... existing code ...

  _getProxyConfig() {
    const { PROXY_CONFIG } = require("../../src/config/environment");

    if (!isProxyConfigValid(PROXY_CONFIG)) {
      return null;
    }

    const portIndex = this.currentProxyPortIndex % PROXY_CONFIG.ports.length;
    const selectedPort = PROXY_CONFIG.ports[portIndex];
    const proxyServer = getProxyServerUrl(PROXY_CONFIG.host, selectedPort);

    return {
      server: proxyServer,
      host: PROXY_CONFIG.host,
      port: selectedPort,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password,
      hasMultiplePorts: PROXY_CONFIG.ports.length > 1,
      totalPorts: PROXY_CONFIG.ports.length,
    };
  }

  async launchBrowser() {
    if (this.browser) {
      return;
    }

    this._rotateProxyPort();
    const proxyConfig = this._getProxyConfig();

    try {
      const launchOptions = getLaunchOptions({
        headless: process.env.NODE_ENV?.trim() !== "development",
        proxyServer: proxyConfig?.server || null,
        protocolTimeout: 120000,
      });

      if (proxyConfig) {
        logger.info("Puppeteer browser launching with Decodo proxy", {
          proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          portRotation: proxyConfig.hasMultiplePorts
            ? `${proxyConfig.totalPorts} ports available`
            : "single port",
        });
      }

      this.browser = await puppeteer.launch(launchOptions);

      logger.info("Puppeteer browser launched", {
        proxyEnabled: proxyConfig !== null,
      });
    } catch (error) {
      logger.error("Error launching Puppeteer browser", { error });

      if (proxyConfig) {
        logger.warn(
          "Browser launch with proxy failed, retrying without proxy",
          { error: error.message }
        );

        try {
          const fallbackOptions = getLaunchOptions({
            headless: process.env.NODE_ENV?.trim() !== "development",
            proxyServer: null,
            protocolTimeout: 120000,
          });

          this.browser = await puppeteer.launch(fallbackOptions);
          logger.warn("Browser launched without proxy (fallback mode)");
        } catch (fallbackError) {
          logger.error("Browser launch failed even without proxy", {
            error: fallbackError,
          });
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  // ... rest of the code ...
}
```

**Benefits:**

- ✅ Uses centralized launch config
- ✅ Cleaner proxy logic
- ✅ Less duplication
- ✅ Easier to maintain

---

### Task 6: Refactor dependencies.js

**Current Issues:**

- Duplicated launch args
- Duplicated proxy logic
- Inconsistent with PuppeteerManager

**Refactored Structure:**

```javascript
const {
  getLegacyLaunchOptions,
} = require("../dataProcessing/puppeteer/browserConfig");
const {
  isProxyConfigValid,
  getProxyServerUrl,
} = require("../src/config/proxyConfig");

module.exports = {
  getPuppeteerInstance: async () => {
    const { PROXY_CONFIG } = require("../src/config/environment");

    let proxyServer = null;
    if (isProxyConfigValid(PROXY_CONFIG)) {
      // Use first port for legacy launcher (no rotation)
      const selectedPort = PROXY_CONFIG.ports[0];
      proxyServer = getProxyServerUrl(PROXY_CONFIG.host, selectedPort);
    }

    const launchOptions = getLegacyLaunchOptions({
      headless: process.env.NODE_ENV !== "development",
      proxyServer,
    });

    const browser = await puppeteer.launch(launchOptions);

    // Authenticate with proxy if needed
    if (proxyServer && PROXY_CONFIG.username && PROXY_CONFIG.password) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].authenticate({
          username: PROXY_CONFIG.username,
          password: PROXY_CONFIG.password,
        });
      }
    }

    return browser;
  },
  // ... other exports ...
};
```

**Benefits:**

- ✅ Consistent with PuppeteerManager
- ✅ Uses centralized config
- ✅ Less duplication
- ✅ Easier to maintain

---

## 📊 Impact Analysis

### Code Reduction

- **Before**: ~450 lines across 3 files
- **After**: ~350 lines (with utilities)
- **Savings**: ~100 lines of duplicated code

### Maintainability

- ✅ Single source of truth for launch args
- ✅ Centralized proxy logic
- ✅ Easier to add new launch arguments
- ✅ Easier to test individual components

### Consistency

- ✅ Same launch args (with appropriate differences for legacy)
- ✅ Same proxy logic
- ✅ Same error handling patterns

---

## 🧪 Testing Strategy

### Unit Tests

1. Test `generatePortsFromRange()` with different ranges
2. Test `buildProxyConfig()` with different env vars (host override, credentials)
3. Test `getLaunchOptions()` with different configurations
4. Test `isProxyConfigValid()` validation

### Integration Tests

1. Test browser launch with proxy
2. Test browser launch without proxy
3. Test proxy rotation
4. Test fallback behavior

### Manual Testing

1. Verify proxy works in PuppeteerManager
2. Verify proxy works in legacy launcher
3. Verify logging output
4. Verify no regressions

---

## 📋 Implementation Order

1. **Phase 1: Extract Utilities** (Low Risk)

   - Create `src/config/proxyConfig.js`
   - Create `dataProcessing/puppeteer/browserConfig.js`
   - Create `src/utils/configLogger.js`
   - Add unit tests

2. **Phase 2: Refactor environment.js** (Low Risk)

   - Use extracted utilities
   - Test configuration loading

3. **Phase 3: Refactor PuppeteerManager.js** (Medium Risk)

   - Use extracted utilities
   - Test browser launch
   - Test proxy rotation

4. **Phase 4: Refactor dependencies.js** (Medium Risk)

   - Use extracted utilities
   - Test legacy launcher
   - Verify consistency

5. **Phase 5: Cleanup & Documentation** (Low Risk)
   - Remove old code
   - Update documentation
   - Final testing

---

## ✅ Success Criteria

- [ ] No code duplication for launch args
- [ ] No code duplication for proxy parsing
- [ ] Centralized logging
- [ ] All tests pass
- [ ] Proxy functionality works in both launchers
- [ ] Code is more maintainable
- [ ] Documentation updated

---

## 🚨 Risk Assessment

### Low Risk

- Extracting utilities (pure functions)
- Centralizing logging
- Refactoring environment.js

### Medium Risk

- Refactoring PuppeteerManager (core functionality)
- Refactoring dependencies.js (legacy code)

### Mitigation

- Comprehensive testing after each phase
- Keep old code until new code is verified
- Gradual rollout

---

## 📝 Notes

- **Backward Compatibility**: All changes maintain existing functionality
- **Performance**: No performance impact expected
- **Breaking Changes**: None - all changes are internal refactoring

---

## 🔄 Rollback Plan

If issues arise:

1. Revert to previous commit
2. All changes are in separate files (utilities)
3. Can disable new utilities and use old code if needed

---

## 📚 Related Files

- `DECODO_INTEGRATION_PLAN.md` - Original integration plan
- `DECODO_SETUP_GUIDE.md` - Setup documentation
- `CONFIGURATION.md` - Configuration guide

---

**Status**: Ready for review and implementation
