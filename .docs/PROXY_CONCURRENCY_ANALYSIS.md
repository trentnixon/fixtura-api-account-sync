# Proxy & Concurrency Flow Analysis - Scrap Categories

## Executive Summary

This document provides a comprehensive analysis of how proxy configuration and concurrency management work together across the different scrap categories (Competitions, Teams, Games, Validation) in the ScrapeAccountSync application.

---

## Architecture Overview

### Core Components

1. **PuppeteerManager** (Singleton)
   - Manages browser lifecycle and page pools
   - Handles proxy configuration and authentication
   - Implements two strategies:
     - **Strategy 1**: Parallel Page Processing (page pool)
     - **Strategy 2**: Page Reuse & Connection Pooling (reusable pages)

2. **Proxy Configuration** (`src/config/proxyConfig.js`)
   - Decodo proxy: `dc.decodo.com`
   - Port range: 10001-10100 (100 ports)
   - Credentials: Username/password authentication
   - Port rotation: Enabled on browser restart

3. **Concurrency Configuration** (`dataProcessing/puppeteer/constants.js`)
   - `COMPETITIONS_CONCURRENCY`: 3 (default)
   - `TEAMS_CONCURRENCY`: 3 (default)
   - `VALIDATION_CONCURRENCY`: 5 (default)
   - `PAGE_POOL_SIZE`: 3 (default)

---

## Proxy Flow

### 1. Proxy Configuration Loading

**Location**: `src/config/proxyConfig.js` → `buildProxyConfig()`

```javascript
// Environment variables:
// - DECODO_PROXY_ENABLED: "true" to enable
// - DECODO_PROXY_HOST: Override host (default: dc.decodo.com)
// - DECODO_PROXY_USERNAME: Proxy username
// - DECODO_PROXY_PASSWORD: Proxy password
// - DECODO_ROTATE_ON_RESTART: "false" to disable rotation
```

**Flow**:
1. Reads `DECODO_PROXY_CONFIG` (hardcoded host + port range)
2. Generates ports array (10001-10100)
3. Builds config object with enabled flag, credentials, and port rotation settings

### 2. Browser Launch with Proxy

**Location**: `dataProcessing/puppeteer/PuppeteerManager.js` → `launchBrowser()`

**Flow**:
1. **Port Rotation**: If enabled and multiple ports available, rotates to next port before launch
2. **Get Proxy Config**: Calls `_getProxyConfig()` which:
   - Selects port using `currentProxyPortIndex % ports.length`
   - Builds proxy server URL: `http://dc.decodo.com:PORT`
   - Returns config with server, host, port, username, password
3. **Browser Launch**: Launches Puppeteer with `--proxy-server` argument
4. **Proxy Authentication**: Authenticates default page immediately after launch:
   ```javascript
   await pages[0].authenticate({
     username: proxyConfig.username,
     password: proxyConfig.password
   });
   ```

**Key Points**:
- Credentials are **NOT** included in proxy URL (Chrome limitation for HTTPS)
- Authentication happens **immediately** after browser launch
- Port rotation occurs **only** on browser restart (not per page)

### 3. Page Creation with Proxy Authentication

**Location**: `dataProcessing/puppeteer/PuppeteerManager.js` → `createPageInNewContext()`

**Flow**:
1. Ensures browser is launched
2. Creates new page via `browser.newPage()`
3. **CRITICAL**: Authenticates page **BEFORE** any other setup:
   ```javascript
   await page.authenticate({
     username: proxyConfig.username,
     password: proxyConfig.password
   });
   ```
4. Sets up page configuration (viewport, user agent, request interception)
5. Tracks page in `activePages` Set

**Why Authentication First?**
- Prevents HTTP 407 (Proxy Authentication Required) errors
- Must happen before any navigation or requests
- Each page needs its own authentication (not inherited from browser)

### 4. Page Pool Creation with Proxy

**Location**: `dataProcessing/puppeteer/PuppeteerManager.js` → `createPagePool()`

**Flow**:
1. Launches browser if needed
2. Creates multiple pages **in parallel** (Promise.all)
3. For each page:
   - Creates page via `browser.newPage()`
   - Authenticates with proxy credentials **immediately**
   - Sets up page configuration
   - Adds to `pagePool` array
4. All pages are ready with proxy authentication before returning

**Key Points**:
- Pages created in parallel for faster initialization
- Each page authenticated individually
- Pages stored in `pagePool` array for round-robin allocation
- Pages **not** marked as active during pool creation (marked when allocated)

---

## Concurrency Flow by Scrap Category

### Stage 1: Competitions (`GetCompetitions`)

**File**: `dataProcessing/scrapeCenter/Competitions/getCompetitions.js`

**Concurrency Strategy**:
- **Chunked Parallel Processing** (not using `processInParallel` utility)
- Creates pages upfront for each chunk
- Processes associations in parallel within chunks

**Flow**:
1. Fetches associations from database
2. Splits into chunks of `COMPETITIONS_CONCURRENCY` size (default: 3)
3. For each chunk:
   - **Creates pages upfront**: `Promise.all(chunk.map(() => createPageInNewContext()))`
   - Each page gets proxy authentication automatically
   - Processes all associations in chunk **in parallel**
   - Each association uses its pre-created page
   - Closes pages after processing
4. Moves to next chunk

**Proxy Impact**:
- Each page creation = 3-4 seconds proxy authentication overhead
- Creating pages upfront ensures true parallel execution
- Pages closed after each chunk (no reuse)

**Concurrency Control**:
- Uses `Promise.all()` for parallel execution within chunks
- Sequential chunk processing (one chunk at a time)
- Default concurrency: 3 associations simultaneously

---

### Stage 2: Teams (`GetTeamsFromLadder`)

**File**: `dataProcessing/scrapeCenter/Ladder/getTeamsFromLadder.js`

**Concurrency Strategy**:
- **Page Pool + `processInParallel` utility**
- Creates page pool before processing
- Uses pool for parallel grade processing

**Flow**:
1. Checks if page pool exists (creates if empty)
2. Creates page pool of size `TEAMS_CONCURRENCY` (default: 3)
   - All pages authenticated with proxy during pool creation
3. Uses `processInParallel()` utility:
   - Processes grades concurrently (up to concurrency limit)
   - Each grade gets page from pool via `getPageFromPool()`
   - Page marked as active when allocated
   - After processing, releases page via `releasePageFromPool()`
4. Pages reused across multiple grades

**Proxy Impact**:
- Page pool created once (3-4 seconds × pool size upfront)
- Pages reused across grades (no additional auth overhead)
- Significant time savings vs creating pages per grade

**Concurrency Control**:
- Uses `p-limit` library internally (via `processInParallel`)
- Default concurrency: 3 grades simultaneously
- Pages wait for availability if pool exhausted

---

### Stage 3: Games (`GetTeamsGameData`)

**File**: `dataProcessing/scrapeCenter/GameData/getGameData.js`

**Concurrency Strategy**:
- **Page Pool + `processInParallel` utility**
- Same pattern as Teams stage
- Processes teams in parallel batches

**Flow**:
1. Checks if page pool exists (creates if empty)
2. Creates page pool of size `TEAMS_CONCURRENCY` (default: 3)
   - All pages authenticated with proxy during pool creation
3. Uses `processInParallel()` utility:
   - Processes teams concurrently (up to concurrency limit)
   - Each team gets page from pool via `getPageFromPool()`
   - Page marked as active when allocated
   - After processing, releases page via `releasePageFromPool()`
4. Pages reused across multiple teams

**Additional Context**:
- Called from `GameDataProcessor.process()` which batches teams (batch size: 10)
- Each batch processes teams in parallel using page pool
- Pool persists across batches (reused)

**Proxy Impact**:
- Page pool created once per batch group
- Pages reused across teams within batch
- Similar time savings as Teams stage

**Concurrency Control**:
- Uses `p-limit` library internally (via `processInParallel`)
- Default concurrency: 3 teams simultaneously
- Batches processed sequentially, teams within batch in parallel

---

### Stage 4: Fixture Validation (`FixtureValidationService`)

**File**: `dataProcessing/services/fixtureValidationService.js`

**Concurrency Strategy**:
- **Page Pool + `processInParallel` utility**
- Creates page pool matching validation concurrency
- Validates fixture URLs in parallel batches

**Flow**:
1. Creates page pool of size `VALIDATION_CONCURRENCY` (default: 5)
   - All pages authenticated with proxy during pool creation
2. Splits fixtures into batches
3. For each batch:
   - Uses `processInParallel()` utility:
     - Validates fixtures concurrently (up to concurrency limit)
     - Each fixture gets page from pool via `getPageFromPool()`
     - Page marked as active when allocated
     - After validation, releases page via `releasePageFromPool()`
4. Pages reused across multiple fixtures

**Proxy Impact**:
- Page pool created once (5 pages × 3-4 seconds = 15-20 seconds upfront)
- Pages reused across fixtures (no additional auth overhead)
- Critical for performance (validates hundreds of fixtures)

**Concurrency Control**:
- Uses `p-limit` library internally (via `processInParallel`)
- Default concurrency: 5 fixtures simultaneously
- Batches processed sequentially, fixtures within batch in parallel

---

## Page Pool Management

### Page Allocation (`getPageFromPool()`)

**Location**: `dataProcessing/puppeteer/PuppeteerManager.js`

**Flow**:
1. Ensures browser is launched
2. Creates pool if empty
3. Filters out closed pages
4. **Waits for available page** (polling mechanism):
   - Checks for page not in `activePages` Set
   - If none available, waits 100ms and retries (max 300 retries = 30 seconds)
   - Prevents race conditions by ensuring page is truly available
5. Marks page as active before returning
6. Returns page for use

**Key Points**:
- **Waits** for available page (doesn't return active pages)
- Prevents multiple tasks from using same page
- Round-robin allocation (finds first available)

### Page Release (`releasePageFromPool()`)

**Location**: `dataProcessing/puppeteer/PuppeteerManager.js`

**Flow**:
1. Checks if page is closed (removes from pool if closed)
2. Removes page from `activePages` Set (makes it available)
3. **Does NOT** navigate to blank page (done on next allocation if needed)
4. Page stays in pool for reuse

**Key Points**:
- Simple release (just removes from active set)
- Page state preserved (can be reset on next use)
- Fast operation (no navigation overhead)

---

## Processing Pipeline Flow

### Overall Sequence

```
1. DataController.start()
   ↓
2. [STAGE] Competitions
   - CompetitionProcessor.process()
   - GetCompetitions.setup()
   - Creates pages upfront per chunk
   - Processes associations in parallel chunks
   ↓
3. [STAGE] Teams
   - TeamProcessor.process()
   - GetTeamsFromLadder.setup()
   - Creates page pool (if needed)
   - Processes grades in parallel
   ↓
4. [STAGE] Games
   - GameDataProcessor.process()
   - GetTeamsGameData.setup()
   - Creates page pool (if needed)
   - Processes teams in parallel batches
   ↓
5. [STAGE] Fixture Validation
   - FixtureValidationProcessor.process()
   - FixtureValidationService.validateFixturesBatch()
   - Creates page pool (if needed)
   - Validates fixtures in parallel batches
   ↓
6. [STAGE] Fixture Cleanup
   - Comparison and deletion (no scraping)
```

### Browser Lifecycle

1. **First Page Creation**: Browser launched automatically
2. **Proxy Port Selection**: Rotates on browser restart (if enabled)
3. **Page Pool Creation**: Creates multiple pages with proxy auth
4. **Page Reuse**: Pages reused across operations (no new auth)
5. **Browser Restart**: Every 150 operations (or memory threshold)
   - Closes all pages
   - Rotates proxy port (if enabled)
   - Launches new browser
   - New pages need authentication again

---

## Performance Optimizations

### Strategy 1: Parallel Page Processing

**What**: Create multiple pages upfront, process items in parallel

**Benefits**:
- True parallel execution (multiple pages navigate simultaneously)
- Reduces total processing time
- Better proxy utilization

**Trade-offs**:
- Higher memory usage (multiple pages active)
- Initial setup time (create pages upfront)

**Used By**:
- Competitions (chunked approach)
- Teams (page pool)
- Games (page pool)
- Validation (page pool)

### Strategy 2: Page Reuse & Connection Pooling

**What**: Reuse pages across multiple navigations

**Benefits**:
- Eliminates 3-4 second proxy auth overhead per operation
- Faster sequential processing
- Better connection reuse

**Trade-offs**:
- Pages must be reset between uses
- State management complexity

**Used By**:
- Single association processing (Competitions)
- Page pool pages (reused across operations)

---

## Configuration Tuning

### Environment Variables

```bash
# Proxy Configuration
DECODO_PROXY_ENABLED=true
DECODO_PROXY_HOST=dc.decodo.com  # Optional override
DECODO_PROXY_USERNAME=your_username
DECODO_PROXY_PASSWORD=your_password
DECODO_ROTATE_ON_RESTART=true  # Default: true

# Concurrency Configuration
PARALLEL_COMPETITIONS_CONCURRENCY=3  # Default: 3
PARALLEL_TEAMS_CONCURRENCY=3         # Default: 3
PARALLEL_VALIDATION_CONCURRENCY=5    # Default: 5
PARALLEL_PAGE_POOL_SIZE=3            # Default: 3

# Memory Management
PUPPETEER_MAX_OPS_BEFORE_RESTART=150  # Default: 150
```

### Tuning Guidelines

**Increase Concurrency** (if memory allows):
- More parallel operations = faster processing
- Watch memory usage (each page ~50-100MB)
- Balance: concurrency vs memory

**Increase Page Pool Size**:
- Match pool size to concurrency limit
- Larger pool = less waiting for pages
- More memory usage

**Proxy Port Rotation**:
- Enabled by default (better load distribution)
- Disable if single port preferred
- Rotation happens on browser restart only

---

## Common Issues & Solutions

### Issue: HTTP 407 (Proxy Authentication Required)

**Cause**: Page not authenticated before navigation

**Solution**:
- Ensure `page.authenticate()` called before `page.goto()`
- Check credentials are not empty strings
- Verify proxy config is valid

**Location**: `PuppeteerManager.createPageInNewContext()` and `createPagePool()`

### Issue: Pages Timing Out Waiting for Pool

**Cause**: Concurrency > pool size, or pages not released

**Solution**:
- Ensure `releasePageFromPool()` called in `finally` block
- Match pool size to concurrency limit
- Check for pages stuck in active state

**Location**: `PuppeteerManager.getPageFromPool()` (30 second timeout)

### Issue: Memory Accumulation

**Cause**: Pages not closed, pool not cleared

**Solution**:
- Browser restarts every 150 operations
- Pages closed on error
- Pool cleared on browser restart

**Location**: `PuppeteerManager.restartBrowser()`

### Issue: Sequential Processing Instead of Parallel

**Cause**: Pages created sequentially, not upfront

**Solution**:
- Create pages upfront using `Promise.all()`
- Use `createPagePool()` before parallel processing
- Ensure `processInParallel()` utility used correctly

**Location**: All scrap category implementations

---

## Summary

### Proxy Flow
1. **Configuration**: Loaded from environment, port range generated
2. **Browser Launch**: Proxy server set, default page authenticated
3. **Page Creation**: Each page authenticated immediately after creation
4. **Page Pool**: Multiple pages created upfront, all authenticated
5. **Port Rotation**: Rotates on browser restart (if enabled)

### Concurrency Flow
1. **Competitions**: Chunked parallel (pages created upfront per chunk)
2. **Teams**: Page pool + parallel processing (pool reused)
3. **Games**: Page pool + parallel processing (pool reused)
4. **Validation**: Page pool + parallel processing (pool reused)

### Key Optimizations
- **Page Pool**: Eliminates repeated proxy auth overhead
- **Parallel Processing**: Multiple operations simultaneously
- **Page Reuse**: Pages reused across operations
- **Upfront Creation**: Pages ready before processing starts

### Performance Impact
- **Without Pool**: 3-4 seconds per page creation (proxy auth)
- **With Pool**: 3-4 seconds × pool size (one-time cost)
- **Parallel Processing**: 3-5x faster (depending on concurrency)
- **Combined**: 60-70% improvement in total processing time

---

## Related Files

- `dataProcessing/puppeteer/PuppeteerManager.js` - Core browser/page management
- `src/config/proxyConfig.js` - Proxy configuration utilities
- `dataProcessing/puppeteer/constants.js` - Concurrency configuration
- `dataProcessing/utils/parallelUtils.js` - Parallel processing utilities
- `dataProcessing/puppeteer/pageSetup.js` - Page configuration
- `dataProcessing/controllers/dataController.js` - Main orchestration
- `PERFORMANCE_OPTIMIZATION.md` - Detailed optimization strategies

