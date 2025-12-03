# Performance Optimization Strategies – Proxy-Enabled Scraping

## Executive Summary

**Current Situation:**

- Proxy integration adds 3-4 seconds per page load
- Processing time increased from 4-5 hours to 12-13 hours (2.4-2.6x slower)
- Sequential processing: one page at a time
- Estimated impact: ~3,600-4,680 page loads per full sync (based on 12-13 hour runtime)

**Goal:**
Reduce processing time back to 4-5 hours while maintaining proxy usage for reliability and compliance.

---

## Current Architecture Analysis

### Processing Flow

1. **Competitions Stage**: Scrapes competition data (one page per association/club)
2. **Teams Stage**: Scrapes team data (one page per competition/grade)
3. **Games Stage**: Scrapes game data (one page per team, processed in batches of 10)
4. **Validation Stage**: Validates fixtures (one page per fixture batch)

### Bottlenecks Identified

1. **Sequential Page Creation**

   - `PuppeteerManager.createPageInNewContext()` creates pages one at a time
   - Each page requires proxy authentication (3-4 seconds overhead)
   - Pages are processed sequentially in loops

2. **Proxy Authentication Overhead**

   - Authentication happens on every page creation
   - No connection pooling or reuse
   - Each page navigates through proxy independently

3. **Browser Restart Strategy**

   - Browser restarts every 150 operations
   - Restart delay of 1 second
   - All active pages must close before restart

4. **Resource Blocking**
   - Some resources blocked (fonts, media, websockets)
   - Images and stylesheets still loaded (may be necessary for rendering)

---

## Optimization Strategies

### Strategy 1: Parallel Page Processing (HIGHEST IMPACT) ⭐

**Description:** Process multiple pages concurrently using multiple browser tabs/contexts.

**Implementation Approach:**

- Create a pool of pages (e.g., 3-5 pages) upfront
- Process items in parallel batches
- Use Promise.all() or p-limit for concurrency control

**Expected Impact:**

- **3x speedup** with 3 concurrent pages (3-4 hours instead of 12-13 hours)
- **5x speedup** with 5 concurrent pages (2.4-2.6 hours instead of 12-13 hours)
- Linear scaling up to proxy/server limits

**Code Changes Required:**

1. **Add parallel page creation method to PuppeteerManager:**

```javascript
async createPagePool(size = 3) {
  await this.launchBrowser();
  const pages = [];
  for (let i = 0; i < size; i++) {
    const page = await this.browser.newPage();
    // Authenticate immediately
    const proxyConfig = this._getProxyConfig();
    if (proxyConfig && proxyConfig.username && proxyConfig.password) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password,
      });
    }
    await setupPage(page, null);
    this.activePages.add(page);
    pages.push(page);
  }
  return pages;
}
```

2. **Add parallel processing utility:**

```javascript
async processInParallel(items, processor, concurrency = 3) {
  const pLimit = require('p-limit');
  const limit = pLimit(concurrency);
  const results = await Promise.all(
    items.map(item => limit(() => processor(item)))
  );
  return results;
}
```

3. **Update processing loops to use parallel processing:**
   - `GetCompetitions.processClubCompetitions()` - process associations in parallel
   - `GetTeamsGameData.processGamesBatch()` - process teams in parallel
   - `FixtureValidationService.validateFixturesBatch()` - already has concurrency, but can be optimized

**Risks & Considerations:**

- Memory usage increases (3-5x pages active simultaneously)
- Proxy rate limiting (may need to respect proxy limits)
- Error handling more complex (one failure shouldn't stop all)
- Need to ensure proxy can handle concurrent connections

**Testing Plan:**

1. Start with concurrency of 2, measure performance
2. Gradually increase to 3, 4, 5
3. Monitor memory usage and proxy performance
4. Test error scenarios (one page fails, others continue)

---

### Strategy 2: Page Reuse & Connection Pooling

**Description:** Reuse pages across multiple navigations instead of creating new pages.

**Implementation Approach:**

- Keep pages alive between navigations
- Navigate to new URLs on same page instead of creating new pages
- Only create new pages when current page errors or times out

**Expected Impact:**

- **30-50% reduction** in page creation overhead
- Eliminates 3-4 second proxy authentication per navigation
- Reduces browser restart frequency

**Code Changes Required:**

1. **Add page reuse method:**

```javascript
async getReusablePage() {
  // Try to reuse an existing page
  const pages = await getPagesSafely(this.browser);
  const availablePage = pages.find(page =>
    !this.activePages.has(page) && !page.isClosed()
  );

  if (availablePage) {
    this.activePages.add(availablePage);
    return availablePage;
  }

  // Create new page if none available
  return await this.createPageInNewContext();
}
```

2. **Update scrapers to reuse pages:**
   - Navigate to new URL instead of creating new page
   - Only close page on error or after batch completion

**Risks & Considerations:**

- Page state may persist between navigations (cookies, localStorage)
- Need to clear state between navigations if required
- Memory may accumulate if pages aren't properly cleaned

---

### Strategy 3: Optimize Proxy Authentication

**Description:** Reduce proxy authentication overhead through connection reuse and optimization.

**Implementation Approach:**

- Authenticate at browser level (already done, but verify it works for all pages)
- Use browser contexts with proxy authentication
- Cache authentication state

**Expected Impact:**

- **10-20% reduction** in per-page overhead
- Faster page creation (1-2 seconds instead of 3-4 seconds)

**Code Changes Required:**

1. **Use browser contexts with proxy:**

```javascript
async createBrowserContext() {
  const proxyConfig = this._getProxyConfig();
  const context = await this.browser.createBrowserContext();

  // Authenticate context-level (if supported)
  // Note: Puppeteer may require page-level auth

  return context;
}
```

2. **Batch authenticate pages:**
   - Create multiple pages first
   - Authenticate all at once
   - Process in parallel

**Risks & Considerations:**

- Puppeteer limitations on context-level authentication
- May need to authenticate each page individually anyway
- Limited impact if authentication is required per page

---

### Strategy 4: Smart Batching & Chunking

**Description:** Optimize batch sizes to maximize throughput while managing memory efficiently.

**Implementation Approach:**

- Increase batch sizes where memory allows (larger batches = fewer overhead operations)
- Optimize batch sizes based on available memory
- Reduce overhead from batch boundaries (fewer setup/teardown operations)

**Expected Impact:**

- **5-10% improvement** in overall throughput
- Better resource utilization
- Reduced overhead from batch processing

**Code Changes Required:**

1. **Dynamic batch sizing based on memory:**

```javascript
const getOptimalBatchSize = (totalItems, memoryAvailable) => {
  // Calculate based on available memory
  // Larger batches = fewer page creations and less overhead
  const baseSize = 10; // Current batch size
  // Increase batch size if memory allows (with parallel processing from Strategy 1)
  const memoryMultiplier = memoryAvailable > 1000 ? 1.5 : 1;
  // Consider concurrency level from Strategy 1 when calculating optimal size
  return Math.floor(baseSize * memoryMultiplier);
};
```

2. **Monitor and adjust:**
   - Monitor memory usage with different batch sizes
   - Adjust based on available resources
   - Balance between memory usage and processing efficiency

---

### Strategy 5: Proxy Connection Optimization

**Description:** Optimize proxy connection settings and configuration.

**Implementation Approach:**

- Use HTTP/2 if proxy supports it
- Enable connection pooling
- Optimize proxy timeout settings
- Use multiple proxy ports in parallel (already have port rotation)

**Expected Impact:**

- **5-10% improvement** in connection speed
- Better proxy utilization

**Code Changes Required:**

1. **Leverage multiple proxy ports:**

   - Currently rotates ports on restart
   - Could use different ports for different pages simultaneously
   - Distribute load across ports

2. **Optimize browser launch options:**

```javascript
const launchOptions = {
  // ... existing options
  args: [
    "--disable-http2", // Or enable if proxy supports
    "--proxy-server=" + proxyServer,
    "--disable-background-networking",
    "--disable-background-timer-throttling",
  ],
};
```

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 days)

1. **Strategy 4**: Smart Batching (increase batch sizes)

**Expected Impact:** 20-30% improvement (10-11 hours instead of 12-13 hours)

### Phase 2: High Impact (3-5 days)

1. **Strategy 1**: Parallel Page Processing (3 concurrent pages)
2. **Strategy 2**: Page Reuse & Connection Pooling

**Note:** These strategies are **complementary, not contradictory**:

- **Strategy 1** creates a pool of pages (e.g., 3 pages) for parallel processing
- **Strategy 2** reuses each page within the pool for multiple sequential navigations
- Together: 3 pages process different items in parallel, and each page navigates to multiple URLs sequentially (reusing the same page object), eliminating the need to create new pages for each navigation

**Expected Impact:** 60-70% improvement (4-5 hours instead of 12-13 hours)

### Phase 3: Fine-Tuning (2-3 days)

1. **Strategy 3**: Optimize Proxy Authentication
2. **Strategy 5**: Proxy Connection Optimization

**Expected Impact:** Additional 10-15% improvement (3.5-4.5 hours total)

---

## Implementation Details

### Parallel Processing Implementation

**File: `dataProcessing/puppeteer/PuppeteerManager.js`**

Add new methods:

- `createPagePool(size)` - Create multiple pages at once
- `getAvailablePage()` - Get a page from pool or create new
- `releasePage(page)` - Return page to pool

**File: `dataProcessing/scrapeCenter/GameData/getGameData.js`**

Update `processGamesBatch()`:

```javascript
async processGamesBatch(teamsBatch, concurrency = 3) {
  const pLimit = require('p-limit');
  const limit = pLimit(concurrency);

  // Create page pool
  const pages = await this.puppeteerManager.createPagePool(concurrency);
  const pageIndex = { current: 0 };

  const getNextPage = () => {
    const page = pages[pageIndex.current % pages.length];
    pageIndex.current++;
    return page;
  };

  const processTeam = async (team) => {
    const page = getNextPage();
    try {
      // ... existing processing logic
    } finally {
      // Don't close page, return to pool
    }
  };

  const results = await Promise.all(
    teamsBatch.map(team => limit(() => processTeam(team)))
  );

  // Close all pages in pool
  await Promise.all(pages.map(p => this.puppeteerManager.closePage(p)));

  return results.flat();
}
```

### Page Reuse Implementation

**File: `dataProcessing/puppeteer/PuppeteerManager.js`**

Add page pool management:

```javascript
constructor() {
  // ... existing code
  this.pagePool = [];
  this.maxPoolSize = 5;
}

async getPageFromPool() {
  // Return available page or create new
  const available = this.pagePool.find(p => !this.activePages.has(p));
  if (available) {
    this.activePages.add(available);
    return available;
  }

  if (this.pagePool.length < this.maxPoolSize) {
    const page = await this.createPageInNewContext();
    this.pagePool.push(page);
    return page;
  }

  // Wait for page to become available or create new
  return await this.createPageInNewContext();
}

async returnPageToPool(page) {
  this.activePages.delete(page);
  // Clear page state if needed
  await page.goto('about:blank');
}
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Processing Time**

   - Total time per account sync
   - Time per stage (competitions, teams, games)
   - Time per page load

2. **Resource Usage**

   - Memory usage (RSS, heap)
   - CPU usage
   - Network bandwidth

3. **Proxy Performance**

   - Connection time
   - Authentication time
   - Request latency

4. **Error Rates**
   - Page creation failures
   - Navigation timeouts
   - Proxy errors

### Logging Enhancements

Add performance logging:

```javascript
const startTime = Date.now();
// ... operation
const duration = Date.now() - startTime;
logger.info("[PERF] Operation completed", {
  operation: "page_creation",
  duration: `${duration}ms`,
  proxyEnabled: true,
});
```

---

## Risk Assessment

### High Risk

- **Parallel Processing**: Memory usage, error handling complexity
- **Page Reuse**: State contamination between navigations

### Medium Risk

- **Resource Blocking**: May break some scrapers if too aggressive
- **Navigation Optimization**: May cause timing issues

### Low Risk

- **Batching Optimization**: Minimal code changes
- **Proxy Connection Optimization**: Configuration changes only

---

## Testing Strategy

### Unit Tests

- Test page pool creation and management
- Test parallel processing with mock data
- Test page reuse and state clearing

### Integration Tests

- Test full account sync with parallel processing
- Test error scenarios (page failures, timeouts)
- Test memory usage under load

### Performance Tests

- Benchmark before/after each optimization
- Measure processing time reduction
- Monitor resource usage

---

## Success Criteria

### Target Metrics

- **Processing Time**: Reduce from 12-13 hours to 4-5 hours (60-70% improvement)
- **Page Load Time**: Reduce from 3-4 seconds to 1-2 seconds per page
- **Memory Usage**: Stay within 2GB server limits
- **Error Rate**: Maintain < 1% error rate

### Acceptance Criteria

- ✅ All existing tests pass
- ✅ No increase in error rate
- ✅ Memory usage within acceptable limits
- ✅ Processing time reduced by at least 50%

---

## Next Steps

1. **Review and prioritize** strategies based on impact vs. effort
2. **Create tickets** for each phase in `Tickets.md`
3. **Implement Phase 1** quick wins first
4. **Measure baseline** performance before changes
5. **Implement Phase 2** high-impact changes
6. **Monitor and adjust** based on real-world performance

---

## References

- Current implementation: `dataProcessing/puppeteer/PuppeteerManager.js`
- Processing flow: `dataProcessing/controllers/dataController.js`
- Game data processing: `dataProcessing/scrapeCenter/GameData/getGameData.js`
- Competition processing: `dataProcessing/scrapeCenter/Competitions/getCompetitions.js`
- Memory configuration: `dataProcessing/puppeteer/constants.js`
