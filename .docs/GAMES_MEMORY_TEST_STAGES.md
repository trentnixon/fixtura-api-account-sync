# Games Processing - Testable Stages for Memory Testing

**Date:** 2025-12-05
**Purpose:** Identify discrete stages within games processing that can be tested independently for memory issues

---

## 🎯 Testable Stages Overview

The games processing flow can be broken down into **5 main testable stages**, each with memory logging points:

```
1. Category Grouping Stage
   ↓
2. Category Processing Stage (Scraping)
   ├─> 2a. Batch Creation
   ├─> 2b. Page Pool Creation
   ├─> 2c. Batch Scraping (Parallel)
   └─> 2d. Result Aggregation
   ↓
3. Fixture Assignment Stage
   ├─> 3a. Assignment Batch Creation
   └─> 3b. Batch Assignment (Sequential)
   ↓
4. Cleanup Stage
   └─> 4a. Browser Restart / Page Pool Clear / GC
   ↓
5. Category Loop (Repeat for each category)
```

---

## 📋 Stage Details

### Stage 1: Category Grouping

**Location:** `gameDataProcessor.js` → `process()` method (lines ~467-468)

**What it does:**

- Builds grade-to-competition map from `dataObj.Grades`
- Groups teams by competition/category
- Creates `categoryMap` with structure: `Map<categoryKey, {compID, compName, teams[]}>`

**Memory Logging Points:**

- ❌ **No explicit memory logging** (could add)

**Testable:**

- ✅ Yes - Can test independently
- Test with: `ISOLATE_BY_CATEGORY=true` (to trigger grouping)

**Memory Concerns:**

- Large `dataObj.Grades` array
- Large `dataObj.TEAMS` array
- Category map creation

**How to Test:**

```bash
# Enable category isolation to trigger grouping
ISOLATE_BY_CATEGORY=true

# Test with specific category (optional)
TEST_CATEGORY_ID=123
```

**Expected Memory:**

- Baseline: ~400-500 MB
- After grouping: +50-100 MB (depends on number of teams/categories)

---

### Stage 2: Category Processing (Scraping)

**Location:** `gameDataProcessor.js` → `processCategory()` method (lines ~113-358)

**Sub-stages:**

#### Stage 2a: Batch Creation

**What it does:**

- Splits category teams into batches
- Determines batch size and concurrency
- Creates `teamBatches` array

**Memory Logging Points:**

- ✅ Memory logged BEFORE: `COMPETITION-{N}-START` (line ~152)
- ❌ No memory logged after batch creation

**Testable:**

- ✅ Yes - Can test batch creation logic
- Controlled by: `GAME_DATA_BATCH_SIZE` and `GAME_DATA_BATCH_CONCURRENCY`

**Memory Concerns:**

- Batch array creation
- Memory-aware batch sizing (if memory high, reduces batch size)

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_BATCH_SIZE=5          # Test different sizes: 2, 3, 5, 10
GAME_DATA_BATCH_CONCURRENCY=2    # Test different concurrency: 1, 2, 3
```

**Expected Memory:**

- Baseline: ~400-500 MB
- After batch creation: +10-20 MB

---

#### Stage 2b: Page Pool Creation

**Location:** `gameDataProcessor.js` → `processCategory()` (lines ~200-211)

**What it does:**

- Creates Puppeteer page pool if not exists
- Pool size = `PARALLEL_TEAMS_CONCURRENCY` (default: 2)

**Memory Logging Points:**

- ❌ No explicit memory logging (could add)

**Testable:**

- ✅ Yes - Can test page pool creation
- Controlled by: `PARALLEL_TEAMS_CONCURRENCY`

**Memory Concerns:**

- Browser pages consume memory (~50-100 MB per page)
- Page pool size affects memory usage

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
PARALLEL_TEAMS_CONCURRENCY=1    # Test: 1, 2, 3
```

**Expected Memory:**

- Baseline: ~400-500 MB
- After page pool creation: +100-200 MB (depends on pool size)

---

#### Stage 2c: Batch Scraping (Parallel)

**Location:** `gameDataProcessor.js` → `processCategory()` (lines ~214-265)
**Calls:** `getGameData.js` → `processGamesBatch()` → `GameDataFetcher.fetchGameData()`

**What it does:**

- Processes team batches in parallel
- Each batch scrapes game data for its teams
- Uses page pool for parallel processing
- Returns scraped fixtures

**Memory Logging Points:**

- ❌ No memory logging per batch (could add)
- ✅ Memory logged AFTER: `COMPETITION-{N}-COMPLETE` (line ~298)

**Testable:**

- ✅ Yes - Can test individual batches
- Controlled by: `GAME_DATA_BATCH_SIZE`, `GAME_DATA_BATCH_CONCURRENCY`

**Memory Concerns:**

- **CRITICAL:** Scraped fixtures accumulate in memory
- Each batch returns fixtures array
- Parallel processing multiplies memory usage

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_BATCH_SIZE=3          # Small batches
GAME_DATA_BATCH_CONCURRENCY=1   # Sequential (no parallel)
```

**Expected Memory:**

- Baseline: ~400-500 MB
- During scraping: +200-400 MB (depends on number of fixtures)
- **RISK:** Can spike to 1GB+ if many fixtures

---

#### Stage 2d: Result Aggregation

**Location:** `gameDataProcessor.js` → `processCategory()` (lines ~267-282)

**What it does:**

- Aggregates scraped fixtures from all batches
- Creates `categoryScrapedGameData` array
- Extracts fixture IDs

**Memory Logging Points:**

- ✅ Memory logged AFTER aggregation: `COMPETITION-{N}-COMPLETE` (line ~298)

**Testable:**

- ✅ Yes - Can test aggregation logic
- This is where memory accumulates!

**Memory Concerns:**

- **CRITICAL:** All fixtures accumulated here before assignment
- `categoryScrapedGameData` grows with each batch
- Can reach 1GB+ for large categories

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_BATCH_SIZE=5          # Test with different batch sizes
```

**Expected Memory:**

- Baseline: ~400-500 MB
- After aggregation: +300-800 MB (depends on fixtures scraped)
- **RISK:** Can exceed 1.5GB for large categories

---

### Stage 3: Fixture Assignment

**Location:** `gameDataProcessor.js` → `process()` method (lines ~530-567)
**Calls:** `assignGameData.js` → `setup()` → `processBatch()`

**Sub-stages:**

#### Stage 3a: Assignment Batch Creation

**What it does:**

- Splits `categoryScrapedGameData` into assignment batches
- Batch size = `GAME_DATA_ASSIGNMENT_BATCH_SIZE` (default: 10)

**Memory Logging Points:**

- ❌ No explicit memory logging (could add)

**Testable:**

- ✅ Yes - Can test assignment batch creation
- Controlled by: `GAME_DATA_ASSIGNMENT_BATCH_SIZE`

**Memory Concerns:**

- Assignment batch array creation
- Still holding `categoryScrapedGameData` in memory

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_ASSIGNMENT_BATCH_SIZE=5    # Test: 5, 10, 20
```

**Expected Memory:**

- Same as after aggregation (no change)

---

#### Stage 3b: Batch Assignment (Sequential)

**Location:** `assignGameData.js` → `setup()` → `processBatch()` → `processGame()`

**What it does:**

- Assigns fixtures to CMS in batches
- Each batch creates/updates games via API
- Processes sequentially (one batch at a time)

**Memory Logging Points:**

- ❌ No memory logging per assignment batch (could add)
- ✅ GC forced after every 2 batches (line ~559)

**Testable:**

- ✅ Yes - Can test assignment batches independently
- Controlled by: `GAME_DATA_ASSIGNMENT_BATCH_SIZE`

**Memory Concerns:**

- **CRITICAL:** `categoryScrapedGameData` still in memory during assignment
- Assignment objects created/destroyed per batch
- API responses may accumulate

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_ASSIGNMENT_BATCH_SIZE=3    # Small batches
```

**Expected Memory:**

- During assignment: Same as after aggregation
- After assignment: Should drop (data cleared at line ~565)

---

### Stage 4: Cleanup

**Location:** `gameDataProcessor.js` → `cleanupBetweenCategories()` (lines ~361-441)

**What it does:**

- Browser restart (if memory high or forced)
- Cleanup orphaned pages
- Clear page pool
- Force GC (2 passes)

**Memory Logging Points:**

- ✅ Memory logged AFTER cleanup: `COMPETITION-{N}-CLEANUP` (line ~422)

**Testable:**

- ✅ Yes - Can test cleanup independently
- Controlled by: `FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES`

**Memory Concerns:**

- Browser restart clears browser memory
- Page pool clearing frees page memory
- GC should recover memory

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
```

**Expected Memory:**

- Before cleanup: Peak memory (after assignment)
- After cleanup: Should drop to ~400-600 MB
- **KEY METRIC:** Memory should return to baseline

---

### Stage 5: Category Loop

**Location:** `gameDataProcessor.js` → `process()` method (lines ~517-583)

**What it does:**

- Loops through all categories sequentially
- Processes each category (Stages 2-4)
- Tracks fixture IDs only (minimal memory)

**Memory Logging Points:**

- ✅ Memory logged before each category: `COMPETITION-{N}-START`
- ✅ Memory logged after each category: `COMPETITION-{N}-COMPLETE`
- ✅ Memory logged after cleanup: `COMPETITION-{N}-CLEANUP`

**Testable:**

- ✅ Yes - Can test multiple categories
- Controlled by: `ISOLATE_BY_CATEGORY`, `TEST_CATEGORY_ID`

**Memory Concerns:**

- **CRITICAL:** Memory should stabilize between categories
- Each category should reset memory to baseline
- If memory grows between categories = **MEMORY LEAK**

**How to Test:**

```bash
ISOLATE_BY_CATEGORY=true
# Don't set TEST_CATEGORY_ID - process all categories
```

**Expected Memory Pattern:**

```
Category 1: 400 MB → 600 MB → 450 MB (after cleanup) ✅
Category 2: 450 MB → 600 MB → 450 MB (after cleanup) ✅
Category 3: 450 MB → 600 MB → 450 MB (after cleanup) ✅
```

**Warning Signs:**

```
Category 1: 400 MB → 600 MB → 500 MB ⚠️ (not dropping)
Category 2: 500 MB → 700 MB → 600 MB ⚠️ (growing)
Category 3: 600 MB → 900 MB → 800 MB ❌ (MEMORY LEAK!)
```

---

## 🛠️ Memory Testing Features

### Memory Logging at Each Stage

Memory is now automatically logged at each testable stage with the format:

```
[GAMES] [MEMORY-TEST] [STAGE_NAME] [CONTEXT] Memory: RSS=X.XX MB, Heap=Y.YY MB
```

### Stop Process at Specific Stage

You can stop the process at any stage for memory inspection by setting:

```bash
MEMORY_TEST_STOP_AT_STAGE=<stage_name>
```

**Available Stage Names:**

- `CATEGORY_GROUPING_START` - Before category grouping
- `CATEGORY_GROUPING_COMPLETE` - After category grouping
- `CATEGORY_START` - Before category processing starts
- `BATCH_CREATION` - After batches are created
- `PAGE_POOL_CREATED` - After page pool is created
- `BEFORE_BATCH_SCRAPING` - Before each batch scraping starts
- `AFTER_BATCH_SCRAPING` - After each batch scraping completes
- `AFTER_AGGREGATION` - After all batches aggregated
- `BEFORE_ASSIGNMENT_BATCH_CREATION` - Before assignment batches created
- `AFTER_ASSIGNMENT_BATCH_CREATION` - After assignment batches created
- `BEFORE_BATCH_ASSIGNMENT` - Before each assignment batch
- `AFTER_BATCH_ASSIGNMENT` - After each assignment batch
- `BEFORE_CLEANUP` - Before cleanup starts
- `AFTER_CLEANUP` - After cleanup completes

**Example Usage:**

```bash
# Stop after batch scraping to inspect memory
MEMORY_TEST_STOP_AT_STAGE=AFTER_BATCH_SCRAPING
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
```

The process will:

1. Log memory at that stage
2. Throw an error to stop the process
3. Allow you to inspect memory state

---

## 🧪 Testing Strategy

### Test 1: Single Category - Small Batch

**Purpose:** Test basic scraping and assignment with minimal memory

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_BATCH_SIZE=2
GAME_DATA_BATCH_CONCURRENCY=1
GAME_DATA_ASSIGNMENT_BATCH_SIZE=5
# Optional: Stop at specific stage to inspect memory
# MEMORY_TEST_STOP_AT_STAGE=AFTER_AGGREGATION
```

**What to Monitor:**

- Memory before category: Baseline (~400 MB)
- Memory after scraping: Should be <700 MB
- Memory after assignment: Should drop
- Memory after cleanup: Should return to baseline

---

### Test 2: Single Category - Large Batch

**Purpose:** Test memory spike with larger batches

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_BATCH_SIZE=10
GAME_DATA_BATCH_CONCURRENCY=2
GAME_DATA_ASSIGNMENT_BATCH_SIZE=20
```

**What to Monitor:**

- Memory spike during scraping (may exceed 1GB)
- Memory recovery after assignment
- Memory recovery after cleanup

---

### Test 3: Multiple Categories - Memory Stability

**Purpose:** Test if memory stabilizes between categories

```bash
ISOLATE_BY_CATEGORY=true
# Don't set TEST_CATEGORY_ID - process all
GAME_DATA_BATCH_SIZE=3
GAME_DATA_BATCH_CONCURRENCY=1
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
```

**What to Monitor:**

- Memory pattern across categories
- Should stabilize around 400-600 MB
- Should NOT grow between categories

---

### Test 4: Page Pool Memory

**Purpose:** Test page pool memory impact

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
PARALLEL_TEAMS_CONCURRENCY=1    # Test: 1, 2, 3
```

**What to Monitor:**

- Memory after page pool creation
- Memory during parallel scraping
- Memory after page pool cleanup

---

### Test 5: Assignment Batch Size Impact

**Purpose:** Test assignment batch size on memory

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123
GAME_DATA_ASSIGNMENT_BATCH_SIZE=3    # Test: 3, 5, 10, 20
```

**What to Monitor:**

- Memory during assignment (should be same)
- Memory after assignment (should drop)
- Time to complete assignment

---

## 📊 Memory Logging Points Summary

| Stage                            | Memory Logging                                      | Stop Point | Status    |
| -------------------------------- | --------------------------------------------------- | ---------- | --------- |
| Category Grouping Start          | ✅ `CATEGORY_GROUPING_START`                        | ✅ Yes     | ✅ Active |
| Category Grouping Complete       | ✅ `CATEGORY_GROUPING_COMPLETE`                     | ✅ Yes     | ✅ Active |
| Category Start                   | ✅ `COMPETITION-{N}-START` + `CATEGORY_START`       | ✅ Yes     | ✅ Active |
| After Batch Creation             | ✅ `BATCH_CREATION`                                 | ✅ Yes     | ✅ Active |
| After Page Pool Creation         | ✅ `PAGE_POOL_CREATED`                              | ✅ Yes     | ✅ Active |
| Before Batch Scraping            | ✅ `BEFORE_BATCH_SCRAPING`                          | ✅ Yes     | ✅ Active |
| After Batch Scraping             | ✅ `AFTER_BATCH_SCRAPING`                           | ✅ Yes     | ✅ Active |
| After Aggregation                | ✅ `COMPETITION-{N}-COMPLETE` + `AFTER_AGGREGATION` | ✅ Yes     | ✅ Active |
| Before Assignment Batch Creation | ✅ `BEFORE_ASSIGNMENT_BATCH_CREATION`               | ✅ Yes     | ✅ Active |
| After Assignment Batch Creation  | ✅ `AFTER_ASSIGNMENT_BATCH_CREATION`                | ✅ Yes     | ✅ Active |
| Before Batch Assignment          | ✅ `BEFORE_BATCH_ASSIGNMENT`                        | ✅ Yes     | ✅ Active |
| After Batch Assignment           | ✅ `AFTER_BATCH_ASSIGNMENT`                         | ✅ Yes     | ✅ Active |
| Before Cleanup                   | ✅ `BEFORE_CLEANUP`                                 | ✅ Yes     | ✅ Active |
| After Cleanup                    | ✅ `COMPETITION-{N}-CLEANUP` + `AFTER_CLEANUP`      | ✅ Yes     | ✅ Active |

---

## 🎯 Recommended Test Sequence

### Step 1: Baseline Test

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=<small_category_id>
GAME_DATA_BATCH_SIZE=2
GAME_DATA_BATCH_CONCURRENCY=1
# Stop after aggregation to check memory
MEMORY_TEST_STOP_AT_STAGE=AFTER_AGGREGATION
```

**Goal:** Establish baseline memory behavior
**What to check:** Memory logged at each stage, stop at aggregation to inspect state

---

### Step 2: Scale Up Test

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=<medium_category_id>
GAME_DATA_BATCH_SIZE=5
GAME_DATA_BATCH_CONCURRENCY=2
```

**Goal:** Test memory with larger batches

---

### Step 3: Full Category Test

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=<large_category_id>
GAME_DATA_BATCH_SIZE=3
GAME_DATA_BATCH_CONCURRENCY=1
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
```

**Goal:** Test memory with large category

---

### Step 4: Multiple Categories Test

```bash
ISOLATE_BY_CATEGORY=true
# Process all categories
GAME_DATA_BATCH_SIZE=3
GAME_DATA_BATCH_CONCURRENCY=1
FORCE_BROWSER_RESTART_BETWEEN_CATEGORIES=true
```

**Goal:** Verify memory stability across categories

---

## 📝 Test Checklist

- [ ] **Stage 1:** Category grouping memory impact
- [ ] **Stage 2a:** Batch creation memory impact
- [ ] **Stage 2b:** Page pool creation memory impact
- [ ] **Stage 2c:** Batch scraping memory impact (per batch)
- [ ] **Stage 2d:** Result aggregation memory spike
- [ ] **Stage 3a:** Assignment batch creation memory
- [ ] **Stage 3b:** Assignment memory during processing
- [ ] **Stage 4:** Cleanup effectiveness (memory recovery)
- [ ] **Stage 5:** Memory stability across multiple categories

---

## 🔍 Key Metrics to Track

1. **Memory Before Category:** Baseline (~400 MB)
2. **Memory After Scraping:** Peak during scraping (~600-1000 MB)
3. **Memory After Aggregation:** Peak before assignment (~600-1200 MB)
4. **Memory After Assignment:** Should drop (~500-700 MB)
5. **Memory After Cleanup:** Should return to baseline (~400-600 MB)
6. **Memory Increase Per Category:** Should be <300 MB
7. **Memory Recovery:** Should drop >200 MB after cleanup

---

## ⚠️ Warning Signs

- Memory increase >500 MB per category
- Memory not dropping after cleanup
- Memory growing between categories
- Memory exceeding 1.5GB at any point
- Memory warnings appearing frequently

---

## 📚 Related Files

- `dataProcessing/processors/gameDataProcessor.js` - Main processor
- `dataProcessing/scrapeCenter/GameData/getGameData.js` - Scraping logic
- `dataProcessing/assignCenter/assignGameData.js` - Assignment logic
- `dataProcessing/utils/memoryTracker.js` - Memory tracking utilities
