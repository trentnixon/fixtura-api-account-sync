# Memory Crisis Solutions - Puppeteer v24

Your app is hitting 844MB memory (exceeding 512MB limit) after Puppeteer v24 update. Here are immediate and long-term solutions.

---

## 🚨 Immediate Problem

- **Before Puppeteer v24**: Memory was fine
- **After Puppeteer v24**: Memory jumps to 844MB+ (exceeds 512MB)
- **Root Cause**: Puppeteer v24 uses significantly more memory than previous versions

---

## ✅ Solutions Implemented

### 1. Automatic Browser Restart Strategy

**What it does**: Restarts the browser every 50 operations to free accumulated memory.

**How it works**:

- Tracks operation count
- After 50 page creations, automatically disposes and restarts browser
- Prevents memory from accumulating over time

**Configurable**: You can adjust `maxOperationsBeforeRestart` in `PuppeteerManager` constructor.

### 2. Aggressive Memory Limits

Added V8 heap size limits:

- `--max_old_space_size=300` - Limits JavaScript heap to 300MB
- `--js-flags=--max-old-space-size=300` - Additional V8 limit

This forces garbage collection more aggressively.

---

## 🔧 Additional Options

### Option 1: Downgrade Puppeteer (Quick Fix)

If Puppeteer v24 is the issue, downgrade to v23:

```powershell
npm install puppeteer@^23.11.1 puppeteer-extra@^3.3.6 puppeteer-extra-plugin-stealth@^2.11.2
```

**Pros**: Immediate fix, proven stable
**Cons**: Lose v24 features, might have CAPTCHA issues again

### Option 2: Reduce Restart Interval

Make browser restart more frequently:

```javascript
// In PuppeteerManager constructor
this.maxOperationsBeforeRestart = 20; // Restart every 20 operations instead of 50
```

**Pros**: More aggressive memory management
**Cons**: Slight performance hit from restarts

### Option 3: Upgrade Heroku Dyno

Upgrade to a dyno with more memory:

```powershell
# Upgrade to Standard-2X (1GB memory)
heroku ps:resize standard-2x -a fixtura-api-account-sync

# Or Performance-M (2.5GB memory)
heroku ps:resize performance-m -a fixtura-api-account-sync
```

**Cost**: ~$50-250/month more
**Pros**: Solves memory issue completely
**Cons**: Higher cost

### Option 4: Use Browser Contexts (Advanced)

Instead of creating new pages, use browser contexts:

```javascript
// Create a context, use it, then close it
const context = await browser.createIncognitoBrowserContext();
const page = await context.newPage();
// ... use page
await context.close(); // Frees all memory from context
```

**Pros**: Better memory isolation
**Cons**: Requires code changes

### Option 5: Process in Smaller Batches

Break large operations into smaller chunks:

```javascript
// Instead of processing 100 items at once
const batches = chunkArray(items, 10);
for (const batch of batches) {
  await processBatch(batch);
  await puppeteerManager.cleanupOrphanedPages();
  // Restart browser every 3 batches
  if (batchIndex % 3 === 0) {
    await puppeteerManager.dispose();
  }
}
```

---

## 🎯 Recommended Approach

### Immediate (Already Done)

1. ✅ Browser restart every 50 operations
2. ✅ Aggressive memory limits
3. ✅ All memory-safe flags

### Short-term (If Still Failing)

1. **Reduce restart interval** to 20-30 operations
2. **Add periodic cleanup** in long-running services
3. **Monitor memory** closely

### Long-term (If Problem Persists)

1. **Consider downgrading** to Puppeteer v23 if v24 is too memory-heavy
2. **Upgrade Heroku dyno** if budget allows
3. **Refactor to use browser contexts** for better isolation

---

## 📊 Memory Monitoring

Add this to track memory:

```javascript
// In your services, add periodic memory logging
setInterval(() => {
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
  logger.info(`Memory: ${rssMB} MB`);

  if (rssMB > 400) {
    logger.warn("Memory getting high, consider cleanup");
  }
}, 30000); // Every 30 seconds
```

---

## 🔍 Debugging

### Check for Multiple Browsers

```javascript
// Add this to see if multiple browsers are running
const browserProcesses = await exec("ps aux | grep chrome");
logger.info(`Chrome processes: ${browserProcesses}`);
```

### Check Open Pages

```javascript
const pages = await browser.pages();
logger.info(`Open pages: ${pages.length}`);
if (pages.length > 5) {
  logger.warn("Too many open pages!");
}
```

---

## 💡 Quick Wins

1. **Restart browser more frequently**: Change `maxOperationsBeforeRestart` to 20
2. **Close pages immediately**: Ensure all services call `closePage()` after use
3. **Add cleanup in loops**: Call `cleanupOrphanedPages()` every 10 iterations
4. **Monitor and adjust**: Watch memory, adjust restart interval based on actual usage

---

## 🚨 Emergency Fix

If memory keeps crashing:

```javascript
// In PuppeteerManager, make restart very aggressive
this.maxOperationsBeforeRestart = 10; // Restart every 10 operations
```

This will restart the browser very frequently, but will keep memory low.

---

## 📝 Next Steps

1. **Deploy current changes** (browser restart strategy)
2. **Monitor memory** for 24 hours
3. **If still high**: Reduce restart interval to 20-30
4. **If still failing**: Consider downgrading Puppeteer or upgrading dyno
5. **Long-term**: Refactor to use browser contexts for better memory isolation

The automatic browser restart should help significantly. Monitor and adjust as needed!
