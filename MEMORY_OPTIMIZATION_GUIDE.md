# Memory Optimization Guide for Heroku

Your application is hitting Heroku's memory limit (512MB). This guide explains the optimizations implemented and how to monitor memory usage.

---

## 🚨 Problem

- **Memory Usage**: Jumped from 88MB to 1038MB (exceeded 512MB limit)
- **Heroku Error**: `Error R15 (Memory quota vastly exceeded)`
- **Result**: Process killed with SIGKILL

---

## ✅ Solutions Implemented

### 1. Browser Launch Arguments (Memory-Safe)

Added memory optimization flags that **don't trigger bot detection**:

```javascript
"--disable-gpu"; // Reduces GPU memory usage
"--disable-software-rasterizer"; // Saves memory
"--disable-extensions"; // Reduces memory footprint
"--disable-plugins"; // Saves memory
"--disable-sync"; // Reduces background processes
"--disable-background-timer-throttling"; // Prevents memory leaks
"--disable-backgrounding-occluded-windows"; // Memory optimization
"--disable-renderer-backgrounding"; // Prevents memory accumulation
"--disable-component-extensions-with-background-pages"; // Reduces overhead
"--disable-ipc-flooding-protection"; // Better for automation
"--metrics-recording-only"; // Reduce telemetry overhead
"--mute-audio"; // Disable audio processing
"--disable-notifications"; // Prevent notification pop-ups
"--disable-default-apps"; // Don't load default apps
```

**Why these are safe**: These flags optimize Chrome's internal behavior without changing how the browser appears to websites. They don't affect:

- User agent
- WebGL fingerprinting
- Canvas fingerprinting
- Navigator properties
- Request headers

---

### 2. Page Cleanup Methods

Added helper methods to `PuppeteerManager`:

#### `closePage(page)`

Closes a specific page and frees its memory immediately.

```javascript
// After using a page
await puppeteerManager.closePage(page);
```

#### `cleanupOrphanedPages()`

Closes any pages that are still open but not being used.

```javascript
// Call periodically during long operations
await puppeteerManager.cleanupOrphanedPages();
```

---

## 🔧 How to Use

### In Your Services

After processing with a page, close it:

```javascript
// In fixtureValidationService.js or similar
const page = await this.puppeteerManager.createPageInNewContext();

try {
  // Do your scraping
  await page.goto(url);
  // ... process data
} finally {
  // Always close the page
  await this.puppeteerManager.closePage(page);
}
```

### Periodic Cleanup

For long-running operations, add periodic cleanup:

```javascript
// Every 10-20 operations, clean up orphaned pages
if (operationCount % 10 === 0) {
  await puppeteerManager.cleanupOrphanedPages();
}
```

---

## 📊 Monitoring Memory

### Check Current Memory Usage

```powershell
# View Heroku metrics
heroku ps -a fixtura-api-account-sync

# Watch logs for memory warnings
heroku logs --tail -a fixtura-api-account-sync | grep -i memory
```

### Add Memory Logging

You can add memory tracking to your code:

```javascript
const memoryUsage = process.memoryUsage();
logger.info("Memory Usage", {
  rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
  heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
  heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
});
```

---

## 🎯 Best Practices

### 1. Always Close Pages

```javascript
// ❌ BAD - Page stays in memory
const page = await puppeteerManager.createPageInNewContext();
await page.goto(url);
// Page never closed!

// ✅ GOOD - Page closed after use
const page = await puppeteerManager.createPageInNewContext();
try {
  await page.goto(url);
  // ... process
} finally {
  await puppeteerManager.closePage(page);
}
```

### 2. Reuse Pages When Possible

```javascript
// ❌ BAD - Creates new page for each URL
for (const url of urls) {
  const page = await puppeteerManager.createPageInNewContext();
  await page.goto(url);
  await puppeteerManager.closePage(page);
}

// ✅ GOOD - Reuse same page
const page = await puppeteerManager.createPageInNewContext();
try {
  for (const url of urls) {
    await page.goto(url);
    // ... process
  }
} finally {
  await puppeteerManager.closePage(page);
}
```

### 3. Clean Up Periodically

```javascript
// For long-running operations
let processedCount = 0;
for (const item of items) {
  // Process item
  processedCount++;

  // Clean up every 20 items
  if (processedCount % 20 === 0) {
    await puppeteerManager.cleanupOrphanedPages();
  }
}
```

### 4. Dispose Browser When Done

```javascript
// After all processing is complete
await puppeteerManager.dispose();
```

---

## 🚨 If Memory Still Exceeds

### Option 1: Upgrade Heroku Dyno

```powershell
# Upgrade to Standard-1X (512MB → 512MB, but better performance)
heroku ps:resize standard-1x -a fixtura-api-account-sync

# Or upgrade to Standard-2X (1GB memory)
heroku ps:resize standard-2x -a fixtura-api-account-sync
```

### Option 2: Process in Smaller Batches

```javascript
// Instead of processing all at once
const batches = chunkArray(items, 10); // Process 10 at a time
for (const batch of batches) {
  await processBatch(batch);
  await puppeteerManager.cleanupOrphanedPages();
}
```

### Option 3: Restart Browser Periodically

```javascript
// Every 100 operations, restart browser
if (operationCount % 100 === 0) {
  await puppeteerManager.dispose();
  await puppeteerManager.launchBrowser();
}
```

---

## 🔍 Debugging Memory Issues

### Check for Memory Leaks

1. **Monitor memory over time**:

   ```javascript
   setInterval(() => {
     const mem = process.memoryUsage();
     logger.info("Memory", {
       rss: (mem.rss / 1024 / 1024).toFixed(2) + " MB",
     });
   }, 30000); // Every 30 seconds
   ```

2. **Check for unclosed pages**:

   ```javascript
   const pages = await browser.pages();
   logger.info(`Open pages: ${pages.length}`);
   ```

3. **Check for multiple browsers**:
   - Ensure only one browser instance is created
   - Close browsers when done

---

## 📝 Checklist

- [x] Memory optimization flags added to browser args
- [x] `closePage()` method added
- [x] `cleanupOrphanedPages()` method added
- [ ] Update services to close pages after use
- [ ] Add periodic cleanup in long-running operations
- [ ] Monitor memory usage in production
- [ ] Test memory usage with real workload

---

## 🎯 Expected Results

After implementing these changes:

- ✅ Memory usage should stay under 400-450MB
- ✅ No more R15 errors
- ✅ Pages closed immediately after use
- ✅ Orphaned pages cleaned up automatically
- ✅ Bot detection still works (flags are safe)

---

## 📞 Next Steps

1. **Deploy the changes** (already done)
2. **Update services** to use `closePage()` after page usage
3. **Add periodic cleanup** in long-running operations
4. **Monitor memory** in production logs
5. **Adjust as needed** based on actual usage

The memory optimizations are in place - now ensure pages are being closed properly in your services!
