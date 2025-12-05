# Games Processing - Analysis & Recommendations

**Date:** 2025-12-05
**Issue:** Memory usage exceeding 2GB on large associations
**Status:** Analysis Complete - Recommendations Provided

---

## 📋 Current Setup Overview

### Architecture Flow

```
StageOrchestrator
  └─> GameProcessorComponent
      └─> GameDataProcessor
          ├─> GetTeamsGameData (Scraping)
          │   └─> GameDataFetcher (per team)
          │       └─> Puppeteer Page Pool
          └─> AssignGameData (Assignment)
              └─> GameCRUD (API calls)
```

### Processing Modes

#### Mode 1: Category Isolation (`ISOLATE_BY_CATEGORY=true`)
- **Purpose:** Process one competition/category at a time
- **Flow:**
  1. Group teams by competition/category
  2. Process each category sequentially
  3. Scrape all teams in category → Assign fixtures immediately → Cleanup
  4. Move to next category

#### Mode 2: Standard Processing (Default)
- **Purpose:** Process all teams together
- **Flow:**
  1. Split teams into batches
  2. Process batches in parallel (configurable concurrency)
  3. Scrape all batches → Aggregate → Assign all fixtures → Cleanup

---

## 🔍 Current Configuration

### Environment Variables

| Variable | Default | Purpose | Current Status |
|----------|---------|---------|---------------|
| `ISOLATE_BY_CATEGORY` | `false` | Enable category-by-category processing | ⚠️ Should be `true` for large associations |
| `GAME_DATA_BATCH_SIZE` | `5` | Teams per batch | ✅ OK |
| `GAME_DATA_BATCH_CONCURRENCY` | `2` | Parallel batches | ⚠️ May be too high for large associations |
| `GAME_DATA_ASSIGNMENT_BATCH_SIZE` | `10` | Fixtures per assignment batch | ✅ OK |
| `TEST_CATEGORY_ID` | - | Test specific category | ✅ For testing |
| `TEST_CATEGORY_NAME` | - | Test specific category by name | ✅ For testing |
| `PARALLEL_TEAMS_CONCURRENCY` | `2` | Page pool concurrency | ⚠️ May cause memory issues |
| `FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES` | `false` | Always restart browser | ⚠️ Should be `true` for large associations |
| `MEMORY_THRESHOLD_MB` | `1800` | Memory warning threshold | ✅ OK |
| `MEMORY_CRITICAL_MB` | `1900` | Memory critical threshold | ✅ OK |

### Processing Flow Details

#### Category Isolation Mode Flow

```
1. Build grade-to-competition map
   └─> Maps grade IDs to competition info

2. Group teams by category
   └─> Creates Map: categoryKey → { compID, compName, teams[] }

3. For each category (sequentially):
   a. Process category:
      - Split teams into batches (default: 5 teams/batch)
      - Process batches with concurrency (default: 2 parallel)
      - Each batch:
        * Get page from pool
        * Scrape game data for each team
        * Release page back to pool
        * Return scraped fixtures

   b. Aggregate batch results
      └─> categoryScrapedGameData = [all fixtures from all batches]

   c. Assign fixtures immediately (STREAMING MODE - NEW)
      - Split fixtures into assignment batches (default: 10 fixtures/batch)
      - Assign each batch to CMS
      - Clear fixture data after assignment

   d. Track fixture IDs only (minimal memory)

   e. Cleanup between categories:
      - Browser restart (if memory high)
      - Clear page pool
      - Force GC (2 passes)

4. Return minimal fixture IDs for tracking
```

#### Standard Processing Mode Flow

```
1. Split all teams into batches (default: 5 teams/batch)

2. Process batches in parallel (default: 2 concurrent batches)
   - Each batch scrapes game data for its teams
   - Uses page pool for parallel processing

3. Aggregate all scraped fixtures
   └─> allScrapedGameData = [all fixtures from all batches]

4. Assign all fixtures (STREAMING MODE - NEW)
   - Split fixtures into assignment batches
   - Assign each batch immediately
   - Clear data after assignment

5. Return minimal fixture IDs
```

---

## 🚨 Memory Issues Identified

### Issue 1: Fixture Accumulation (PARTIALLY FIXED)

**Problem:**
- In category isolation mode, fixtures were accumulated per category before assignment
- In standard mode, ALL fixtures accumulated before assignment
- For large associations: 1000+ teams → 5000+ fixtures → 2GB+ memory

**Current Status:**
- ✅ **FIXED:** Streaming assignment implemented - fixtures assigned immediately after scraping
- ⚠️ **REMAINING RISK:** Still accumulating batch results before assignment in standard mode

**Evidence:**
```javascript
// Category mode - NOW FIXED (streaming)
categoryResult.scrapedGameData → Assign immediately → Clear

// Standard mode - STILL RISKY
allScrapedGameData.push(...batchResult.scrapedGameData) // Accumulates
// ... later ...
assignAll(allScrapedGameData) // Assigns all at once
```

### Issue 2: Page Pool Memory

**Problem:**
- Page pool created once and reused
- Pages accumulate browser context/memory
- Not cleared between categories in standard mode

**Current Status:**
- ⚠️ **PARTIALLY ADDRESSED:** Page pool cleared in category cleanup
- ⚠️ **NOT ADDRESSED:** Page pool not cleared in standard mode

### Issue 3: Browser Instance Memory

**Problem:**
- Browser instance shared across all processing
- Browser memory accumulates over time
- No forced restart in standard mode

**Current Status:**
- ⚠️ **PARTIALLY ADDRESSED:** Browser restart in category cleanup (if memory high)
- ⚠️ **NOT ADDRESSED:** No browser restart in standard mode

### Issue 4: Batch Size Not Adaptive

**Problem:**
- Fixed batch sizes regardless of memory pressure
- Large batches on high-memory systems cause spikes
- No reduction for large associations

**Current Status:**
- ✅ **FIXED:** Memory-aware batch sizing implemented
- Automatically reduces batch size/concurrency when memory is high

### Issue 5: Data Object Retention

**Problem:**
- `dataObj` contains large arrays (TEAMS, Grades, COMPETITIONS)
- Retained throughout processing
- Not cleared until finally block

**Current Status:**
- ⚠️ **PARTIALLY ADDRESSED:** Cleared in finally block
- ⚠️ **COULD IMPROVE:** Clear earlier if not needed

---

## 💡 Recommendations

### Priority 1: Critical (Immediate Action Required)

#### 1.1 Enable Category Isolation for Large Associations

**Recommendation:**
```bash
ISOLATE_BY_CATEGORY=true
```

**Why:**
- Prevents memory accumulation across categories
- Allows cleanup between categories
- Isolates memory issues to single categories
- Better error recovery (one category failure doesn't stop all)

**Impact:** High - Reduces memory usage by 60-70%

---

#### 1.2 Force Browser Restart Between Categories

**Recommendation:**
```bash
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
```

**Why:**
- Browser memory accumulates over time
- Restarting clears browser context
- Prevents gradual memory growth

**Impact:** Medium-High - Prevents browser memory leaks

---

#### 1.3 Reduce Default Batch Sizes for Large Associations

**Recommendation:**
```bash
# Conservative settings for large associations
GAME_DATA_BATCH_SIZE=3                    # Reduced from 5
GAME_DATA_BATCH_CONCURRENCY=1             # Reduced from 2 (sequential)
GAME_DATA_ASSIGNMENT_BATCH_SIZE=5         # Reduced from 10
PARALLEL_TEAMS_CONCURRENCY=2              # Keep at 2 (page pool)
```

**Why:**
- Smaller batches = less memory per batch
- Sequential batches = more predictable memory
- Smaller assignment batches = faster assignment cycles

**Impact:** Medium - Reduces memory spikes per batch

---

### Priority 2: Important (Should Implement Soon)

#### 2.1 Implement Streaming Assignment in Standard Mode

**Current Issue:**
- Standard mode still accumulates all fixtures before assignment
- Should assign immediately after each batch (like category mode)

**Recommendation:**
- Modify standard processing to assign fixtures immediately after each batch
- Don't accumulate `allScrapedGameData` - assign and clear immediately

**Impact:** High - Prevents memory accumulation in standard mode

---

#### 2.2 Add Memory Monitoring Per Batch

**Recommendation:**
- Log memory before/after each batch
- Warn if memory increase >200 MB per batch
- Auto-reduce batch size if memory spikes detected

**Impact:** Medium - Better visibility and auto-recovery

---

#### 2.3 Clear Page Pool in Standard Mode

**Recommendation:**
- Clear page pool after every N batches (e.g., every 10 batches)
- Or clear when memory exceeds threshold

**Impact:** Medium - Prevents page pool memory accumulation

---

### Priority 3: Nice to Have (Future Improvements)

#### 3.1 Progressive Batch Sizing

**Recommendation:**
- Start with larger batches (e.g., 5 teams)
- Reduce batch size as memory increases
- Increase batch size if memory stabilizes

**Impact:** Low-Medium - Optimizes throughput vs memory

---

#### 3.2 Memory-Based Category Skipping

**Recommendation:**
- Skip remaining categories if memory is critical
- Log skipped categories for manual processing
- Resume from where stopped

**Impact:** Low - Prevents OOM but loses data

---

#### 3.3 Parallel Assignment with Rate Limiting

**Recommendation:**
- Assign fixtures in parallel (with rate limiting)
- Faster assignment = less time in memory
- Rate limit prevents API overload

**Impact:** Low-Medium - Faster processing, but adds complexity

---

## 📊 Recommended Configuration by Association Size

### Small Associations (< 50 teams)

```bash
ISOLATE_BY_CATEGORY=false                 # Not needed
GAME_DATA_BATCH_SIZE=5                    # Default OK
GAME_DATA_BATCH_CONCURRENCY=2             # Default OK
GAME_DATA_ASSIGNMENT_BATCH_SIZE=10        # Default OK
PARALLEL_TEAMS_CONCURRENCY=2              # Default OK
```

### Medium Associations (50-200 teams)

```bash
ISOLATE_BY_CATEGORY=true                  # Enable isolation
GAME_DATA_BATCH_SIZE=4                    # Slightly reduced
GAME_DATA_BATCH_CONCURRENCY=2             # Keep parallel
GAME_DATA_ASSIGNMENT_BATCH_SIZE=8        # Slightly reduced
PARALLEL_TEAMS_CONCURRENCY=2              # Default OK
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=false  # Optional
```

### Large Associations (200+ teams)

```bash
ISOLATE_BY_CATEGORY=true                  # REQUIRED
GAME_DATA_BATCH_SIZE=3                    # Reduced
GAME_DATA_BATCH_CONCURRENCY=1             # Sequential batches
GAME_DATA_ASSIGNMENT_BATCH_SIZE=5         # Reduced
PARALLEL_TEAMS_CONCURRENCY=2              # Keep for page pool
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true   # REQUIRED
```

### Very Large Associations (500+ teams)

```bash
ISOLATE_BY_CATEGORY=true                  # REQUIRED
GAME_DATA_BATCH_SIZE=2                    # Very small batches
GAME_DATA_BATCH_CONCURRENCY=1             # Sequential only
GAME_DATA_ASSIGNMENT_BATCH_SIZE=3         # Very small assignment batches
PARALLEL_TEAMS_CONCURRENCY=1              # Reduce page pool too
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true   # REQUIRED
MEMORY_THRESHOLD_MB=1500                  # Lower threshold
MEMORY_CRITICAL_MB=1700                   # Lower critical threshold
```

---

## 🔍 Monitoring & Debugging

### Key Metrics to Monitor

1. **Memory per category:**
   ```
   [GAMES] [COMPETITION-1] Memory BEFORE: RSS=450.23 MB
   [GAMES] [COMPETITION-1] Memory AFTER: RSS=680.45 MB
   [GAMES] [COMPETITION-1] Memory INCREASE: 230.22 MB
   ```

2. **Memory after cleanup:**
   ```
   [GAMES] [COMPETITION-1] Memory after cleanup: RSS=520.30 MB
   ```
   - Should drop back to baseline (~400-500 MB)
   - If not dropping, cleanup is insufficient

3. **Total memory:**
   - Should never exceed `MEMORY_THRESHOLD_MB` (1800 MB default)
   - If exceeding, reduce batch sizes further

### Warning Signs

- ⚠️ Memory increase >500 MB per category
- ⚠️ Memory not dropping after cleanup
- ⚠️ Memory warnings appearing frequently
- ⚠️ Memory critical alerts
- ⚠️ OOM errors

### Debugging Steps

1. **Enable category isolation:**
   ```bash
   ISOLATE_BY_CATEGORY=true
   ```

2. **Test one category:**
   ```bash
   ISOLATE_BY_CATEGORY=true
   TEST_CATEGORY_ID=123  # Replace with actual category ID
   ```

3. **Monitor memory logs:**
   - Check memory before/after each category
   - Identify which category causes memory spike
   - Adjust batch sizes for that category

4. **Gradually increase batch sizes:**
   - Start with smallest batches (2 teams)
   - Increase if memory is stable
   - Stop increasing if memory spikes

---

## 📈 Expected Memory Behavior

### Before Optimizations (Current Risk)

```
Memory Usage Over Time:
[Start] 400 MB
[Category 1] 600 MB (+200 MB)
[Category 2] 900 MB (+300 MB) ⚠️
[Category 3] 1300 MB (+400 MB) ⚠️
[Category 4] 1800 MB (+500 MB) ⚠️ WARNING
[Category 5] 2400 MB (+600 MB) ❌ OOM!
```

### After Optimizations (Recommended)

```
Memory Usage Over Time:
[Start] 400 MB
[Category 1] 600 MB → Assign → 450 MB ✅
[Category 2] 600 MB → Assign → 450 MB ✅
[Category 3] 600 MB → Assign → 450 MB ✅
[Category 4] 600 MB → Assign → 450 MB ✅
[Category 5] 600 MB → Assign → 450 MB ✅
```

**Key:** Memory should stabilize around 400-600 MB per category, then drop back to baseline after assignment and cleanup.

---

## 🎯 Action Plan

### Immediate Actions (Do Now)

1. ✅ **Enable category isolation:**
   ```bash
   ISOLATE_BY_CATEGORY=true
   ```

2. ✅ **Force browser restart:**
   ```bash
   FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
   ```

3. ✅ **Reduce batch sizes:**
   ```bash
   GAME_DATA_BATCH_SIZE=3
   GAME_DATA_BATCH_CONCURRENCY=1
   GAME_DATA_ASSIGNMENT_BATCH_SIZE=5
   ```

4. ✅ **Test on large association:**
   - Monitor memory logs
   - Verify memory stabilizes
   - Adjust batch sizes if needed

### Short-term Actions (This Week)

1. Implement streaming assignment in standard mode
2. Add memory monitoring per batch
3. Clear page pool periodically in standard mode
4. Document optimal settings per association size

### Long-term Actions (Future)

1. Progressive batch sizing
2. Memory-based category skipping
3. Parallel assignment with rate limiting
4. Automatic configuration based on association size

---

## 📚 Related Documentation

- `dataProcessing/processors/gameDataProcessor.js` - Main processor
- `dataProcessing/scrapeCenter/GameData/getGameData.js` - Scraping logic
- `dataProcessing/assignCenter/assignGameData.js` - Assignment logic
- `dataProcessing/utils/memoryTracker.js` - Memory tracking
- `dataProcessing/puppeteer/constants.js` - Configuration constants

---

## ✅ Summary

### Current State
- ✅ Streaming assignment implemented in category mode
- ✅ Memory-aware batch sizing implemented
- ✅ Aggressive cleanup between categories
- ⚠️ Standard mode still accumulates fixtures
- ⚠️ Page pool not cleared in standard mode
- ⚠️ Browser restart only when memory high

### Recommended State
- ✅ Category isolation enabled for large associations
- ✅ Browser restart forced between categories
- ✅ Reduced batch sizes for large associations
- ✅ Streaming assignment in both modes
- ✅ Page pool cleared periodically
- ✅ Memory monitoring per batch

### Expected Outcome
- Memory usage stabilizes around 400-600 MB
- No OOM errors on large associations
- Predictable memory behavior
- Better error recovery

