# Heroku CAPTCHA Bypass Guide

This guide ensures your Puppeteer v24 update works correctly on Heroku to bypass CAPTCHA.

## What Was Fixed

The `PuppeteerManager.createPageInNewContext()` method now automatically sets:

- ✅ **User Agent**: Matches Chrome 131.x (used by Puppeteer v24.31.0)
- ✅ **Viewport**: Standard desktop resolution (1920x1080)
- ✅ **WebDriver Override**: Hides `navigator.webdriver` property
- ✅ **Plugin Override**: Makes plugins array look realistic
- ✅ **Language Override**: Sets realistic browser languages

## Why This Matters for Heroku

1. **Different Environment**: Heroku's Linux environment can have different browser fingerprints than your local Windows/Mac
2. **Missing User Agent**: Without explicit user agent, pages may default to automation-detection patterns
3. **Viewport Detection**: Missing or unusual viewports are a common CAPTCHA trigger
4. **WebDriver Property**: The `navigator.webdriver` property is a dead giveaway for automation

## Verification Steps

### 1. After Deploying to Heroku

```powershell
# Watch logs during a scrape
heroku logs --tail -a fixtura-api-account-sync

# Look for:
# - "Puppeteer browser launched" (confirms browser starts)
# - No CAPTCHA-related errors
# - Successful page navigations
```

### 2. Test a Scrape Job

Trigger a test scrape and monitor:

- Does it complete without CAPTCHA?
- Are pages loading successfully?
- Any detection-related errors?

### 3. Check Browser Version

The user agent should match the Chrome version Puppeteer uses:

```javascript
// Puppeteer v24.31.0 uses Chrome 131.x
// User agent: "Mozilla/5.0 ... Chrome/131.0.0.0 ..."
```

## If CAPTCHA Still Appears

### Option 1: Verify Stealth Plugin is Active

Check that `puppeteer-extra-plugin-stealth` is installed and used:

```powershell
# Verify package is installed
npm list puppeteer-extra-plugin-stealth

# Should show: puppeteer-extra-plugin-stealth@^2.11.2
```

### Option 2: Add More Evasions

If needed, you can enhance `PuppeteerManager.createPageInNewContext()` with additional evasions:

```javascript
// Add to the evaluateOnNewDocument section:
await page.evaluateOnNewDocument(() => {
  // Override chrome property
  window.chrome = {
    runtime: {},
  };

  // Override permissions
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === "notifications"
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);
});
```

### Option 3: Use Residential Proxies (Advanced)

If CAPTCHA persists, consider using residential proxies:

```javascript
// In PuppeteerManager.launchBrowser(), add proxy args:
args: [
  // ... existing args
  "--proxy-server=your-proxy-server:port",
];
```

### Option 4: Rotate User Agents

For high-volume scraping, rotate user agents:

```javascript
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

// Randomly select one
const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
await page.setUserAgent(randomUA);
```

## Heroku-Specific Considerations

### 1. Buildpack Requirements

Ensure you have the correct buildpack for Puppeteer:

```powershell
# Check buildpacks
heroku buildpacks -a fixtura-api-account-sync

# Should include:
# heroku/nodejs
```

### 2. Chrome Dependencies

Puppeteer v24 should automatically download Chrome, but verify:

```powershell
# After deployment, check logs for:
# "Downloading Chromium" or similar messages
```

### 3. Memory Limits

Heroku dynos have memory limits. Monitor usage:

```powershell
# Check dyno metrics
heroku ps -a fixtura-api-account-sync

# Watch for memory warnings
heroku logs --tail -a fixtura-api-account-sync | grep -i memory
```

### 4. Environment Variables

Ensure production environment is set:

```powershell
# Verify NODE_ENV
heroku config:get NODE_ENV -a fixtura-api-account-sync

# Should be: production
```

## Testing Checklist

Before considering the deployment successful:

- [ ] Browser launches successfully on Heroku
- [ ] Pages are created with correct user agent
- [ ] Viewport is set correctly
- [ ] No CAPTCHA appears during test scrape
- [ ] Scraping completes successfully
- [ ] Logs show no detection-related errors
- [ ] Memory usage is within limits

## Rollback Plan

If CAPTCHA issues persist:

1. **Check Logs**: Review Heroku logs for specific errors
2. **Compare Local vs Heroku**: Note any differences in behavior
3. **Test Stealth Plugin**: Verify it's working on Heroku
4. **Consider Downgrade**: If needed, temporarily revert to previous Puppeteer version

## Additional Resources

- [Puppeteer Stealth Plugin Docs](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Puppeteer v24 Release Notes](https://github.com/puppeteer/puppeteer/releases)
- [Heroku Buildpack for Node.js](https://elements.heroku.com/buildpacks/heroku/heroku-buildpack-nodejs)

## Key Files Modified

- `dataProcessing/puppeteer/PuppeteerManager.js`: Enhanced `createPageInNewContext()` with anti-detection measures

## Next Steps

1. **Deploy to Heroku** with the updated code
2. **Clear build cache** (already done)
3. **Monitor first scrape** for CAPTCHA issues
4. **Verify logs** show successful page creation
5. **Test multiple scrapes** to ensure consistency

If CAPTCHA still appears after these changes, the issue may be:

- Rate limiting from the target site
- IP-based detection (consider proxies)
- Advanced fingerprinting (may need additional evasions)
