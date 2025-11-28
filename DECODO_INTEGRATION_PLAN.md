# Decodo/Proxy Integration Plan

## 📋 Current State Analysis

### Architecture Overview
- **PuppeteerManager (Singleton)** - Main browser manager
  - Location: `dataProcessing/puppeteer/PuppeteerManager.js`
  - Used by: Most services (GameDataFetcher, GetCompetitions, FixtureValidationService, etc.)
  - Pattern: Singleton pattern, shared browser instance

- **Legacy Browser Launcher**
  - Location: `common/dependencies.js`
  - Used by: BaseController (older code paths)
  - Pattern: Creates new browser per call

### Configuration System
- Centralized in `src/config/environment.js`
- Environment variables loaded via dotenv
- Currently: **No proxy configuration exists**

### Documentation Status
- `DECODO_SETUP_GUIDE.md` exists but references implementation that doesn't exist
- Guide mentions proxy support that isn't actually in code

---

## 🎯 Integration Strategy

### Phase 1: Configuration Setup

#### 1.1 Add Proxy Config to environment.js
**Location:** `src/config/environment.js`

**Add:**
```javascript
// Proxy Configuration (Decodo)
const PROXY_CONFIG = {
  enabled: process.env.DECODO_PROXY_ENABLED === "true",
  server: process.env.DECODO_PROXY_SERVER, // Format: "host:port"
  username: process.env.DECODO_PROXY_USERNAME,
  password: process.env.DECODO_PROXY_PASSWORD,
  // Optional: rotation settings
  rotateOnRestart: process.env.DECODO_ROTATE_ON_RESTART === "true",
};
```

**Export:** Add `PROXY_CONFIG` to module.exports

**Rationale:**
- Centralized configuration
- Easy to enable/disable
- Supports future rotation features

---

### Phase 2: PuppeteerManager Integration

#### 2.1 Add Proxy Helper Method
**Location:** `dataProcessing/puppeteer/PuppeteerManager.js`

**Create method:**
```javascript
_getProxyConfig() {
  const { PROXY_CONFIG } = require("../../src/config/environment");

  if (!PROXY_CONFIG.enabled || !PROXY_CONFIG.server) {
    return null; // No proxy
  }

  // Parse server (format: "host:port")
  const [host, port] = PROXY_CONFIG.server.split(":");

  return {
    server: `http://${host}:${port}`,
    username: PROXY_CONFIG.username,
    password: PROXY_CONFIG.password,
  };
}
```

#### 2.2 Update launchBrowser() Method
**Location:** `dataProcessing/puppeteer/PuppeteerManager.js` (line 43)

**Modify:**
- Call `_getProxyConfig()` before `puppeteer.launch()`
- If proxy config exists, add to launch options:
  ```javascript
  const proxyConfig = this._getProxyConfig();
  const launchOptions = {
    // ... existing options ...
  };

  if (proxyConfig) {
    launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
    // Note: Puppeteer doesn't support auth in args, need to use page.authenticate()
  }
  ```
- Log proxy status (enabled/disabled)

#### 2.3 Add Proxy Authentication to Pages
**Location:** `dataProcessing/puppeteer/PuppeteerManager.js` (in `createPageInNewContext()`)

**After page creation:**
```javascript
// Authenticate with proxy if needed
const proxyConfig = this._getProxyConfig();
if (proxyConfig && proxyConfig.username && proxyConfig.password) {
  await page.authenticate({
    username: proxyConfig.username,
    password: proxyConfig.password,
  });
}
```

---

### Phase 3: Legacy Browser Launcher Integration

#### 3.1 Update dependencies.js
**Location:** `common/dependencies.js` (line 91)

- Import proxy config from environment
- Apply same proxy logic as PuppeteerManager
- Keep consistent behavior

---

### Phase 4: Error Handling & Fallback

#### 4.1 Proxy Connection Errors
**Strategy:**
- If proxy fails, log error and continue without proxy (graceful degradation)
- Don't crash the app
- Log proxy failures for monitoring

**Implementation:**
```javascript
try {
  // Launch with proxy
} catch (proxyError) {
  logger.warn("Proxy connection failed, retrying without proxy", {
    error: proxyError.message
  });
  // Retry without proxy
}
```

#### 4.2 Proxy Validation
- Validate proxy config format on startup
- Warn if config is incomplete
- Allow running without proxy if config is missing

---

### Phase 5: Logging & Monitoring

#### 5.1 Add Proxy Status Logging
- Log when proxy is enabled/disabled
- Log proxy server being used (without credentials)
- Log proxy connection failures
- Track proxy usage metrics

#### 5.2 Health Checks
- Optional: Test proxy connection on startup
- Monitor proxy success/failure rates

---

## 🚀 Implementation Phases

### Phase 1: Core Integration (Priority: HIGH)
1. Add PROXY_CONFIG to environment.js
2. Add `_getProxyConfig()` to PuppeteerManager
3. Update `launchBrowser()` to use proxy
4. Add proxy authentication to pages
5. Update dependencies.js for legacy support

**Estimated Time:** 2-3 hours
**Risk:** Low (can disable via env var)

---

### Phase 2: Error Handling (Priority: HIGH)
1. Add try-catch around proxy setup
2. Implement fallback to no-proxy on failure
3. Add validation for proxy config
4. Add comprehensive logging

**Estimated Time:** 1-2 hours
**Risk:** Low

---

### Phase 3: Testing & Validation (Priority: MEDIUM)
1. Test with proxy enabled
2. Test with proxy disabled
3. Test with invalid proxy config
4. Test proxy failure scenarios
5. Verify both PuppeteerManager and legacy launcher

**Estimated Time:** 2-3 hours
**Risk:** Medium (requires proxy credentials)

---

### Phase 4: Documentation & Deployment (Priority: MEDIUM)
1. Update DECODO_SETUP_GUIDE.md with actual implementation
2. Update CONFIGURATION.md with proxy env vars
3. Add proxy config to Render/Heroku
4. Test in production environment

**Estimated Time:** 1 hour
**Risk:** Low

---

## 🔧 Environment Variables

### Required (when enabled)
```bash
DECODO_PROXY_ENABLED=true
DECODO_PROXY_SERVER=proxy.decodo.com:8080
DECODO_PROXY_USERNAME=your-username
DECODO_PROXY_PASSWORD=your-password
```

### Optional
```bash
DECODO_ROTATE_ON_RESTART=false  # Future: rotate proxy on browser restart
```

---

## 🎨 Design Decisions

### 1. Centralized Configuration
- Single source of truth in `environment.js`
- Easy to enable/disable
- Consistent across codebase

### 2. Graceful Degradation
- App works without proxy
- Falls back if proxy fails
- No crashes from proxy issues

### 3. Dual Support
- Update both PuppeteerManager and legacy launcher
- Maintain backward compatibility
- Gradual migration path

### 4. Security
- Never log credentials
- Store in environment variables only
- Validate config format

---

## 🧪 Testing Strategy

### Unit Tests
- Test `_getProxyConfig()` with various configs
- Test proxy parsing (host:port)
- Test validation logic

### Integration Tests
- Test browser launch with proxy
- Test browser launch without proxy
- Test proxy authentication
- Test fallback on proxy failure

### Manual Testing
1. Set proxy env vars
2. Run a test scrape
3. Verify proxy is used (check logs)
4. Verify no CAPTCHA errors
5. Test with proxy disabled
6. Test with invalid proxy config

---

## 🔄 Rollback Plan

### If Proxy Causes Issues
1. Set `DECODO_PROXY_ENABLED=false` (or unset it)
2. App runs without proxy immediately
3. No code changes needed

### If Proxy Breaks Browser Launch
- Fallback logic should catch errors
- App continues without proxy
- Logs will show the issue

---

## 🔮 Future Enhancements (NOT in Initial Implementation)

### Proxy Rotation
- Rotate proxy IPs on browser restart
- Support multiple proxy servers
- Load balancing across proxies

### Proxy Health Monitoring
- Track proxy success rates
- Auto-disable failing proxies
- Alert on proxy issues

### Per-Request Proxy Selection
- Different proxies for different sites
- Geographic proxy selection
- Cost optimization

---

## 📁 Files to Modify

1. `src/config/environment.js` - Add PROXY_CONFIG
2. `dataProcessing/puppeteer/PuppeteerManager.js` - Add proxy support
3. `common/dependencies.js` - Add proxy support (legacy)
4. `DECODO_SETUP_GUIDE.md` - Update with actual implementation
5. `CONFIGURATION.md` - Add proxy env vars documentation

---

## ✅ Success Criteria

- ✅ Proxy can be enabled via environment variable
- ✅ Browser launches with proxy when configured
- ✅ Proxy authentication works
- ✅ App continues if proxy fails
- ✅ Both PuppeteerManager and legacy launcher support proxy
- ✅ No crashes from proxy issues
- ✅ Clear logging of proxy status

---

## ❓ Questions to Resolve

1. **Proxy Format:** Confirm Decodo format (host:port vs full URL)
2. **Authentication Method:** Username/password vs IP whitelisting
3. **Testing:** Do you have Decodo credentials for testing?
4. **Deployment:** Render or Heroku? (affects env var setup)
5. **Rotation:** Needed now or later?

---

## 📝 Next Steps

1. ✅ Review and approve this plan
2. ⏳ Get Decodo credentials for testing
3. ⏳ Implement Phase 1 (Core Integration)
4. ⏳ Test with credentials
5. ⏳ Implement Phase 2 (Error Handling)
6. ⏳ Deploy to staging/test environment
7. ⏳ Monitor and adjust
8. ⏳ Deploy to production

---

## 📚 References

- [Decodo Website](https://decodo.com/scraping/web)
- [Puppeteer Proxy Documentation](https://pptr.dev/#?product=Puppeteer&version=v24.31.0&show=api-pageauthenticatecredentials)
- Existing: `DECODO_SETUP_GUIDE.md`
- Configuration: `src/config/environment.js`

