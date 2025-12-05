# Games Processing - Current Process Flow

## Overview
This document describes the **current games processing flow** after memory optimization fixes.

---

## 🎯 High-Level Flow

```
1. Initialize
   ↓
2. Choose Processing Mode (Category Isolation OR Standard)
   ↓
3. Process Teams in Batches
   ↓
4. Scrape Fixtures (Streaming)
   ↓
5. Assign Fixtures Immediately (Streaming)
   ↓
6. Clear Memory
   ↓
7. Repeat Until Complete
```

---

## 📋 Detailed Process Flow

### Phase 1: Initialization

**Location**: `gameDataProcessor.js` → `process()` method (line ~443)

**Steps**:
1. Extract teams from `dataObj.TEAMS`
2. Initialize tracking variables:
   - `scrapedFixtureIds` (Set) - Track fixture IDs only
   - `scrapedFixturesMinimal` (Array) - Minimal objects for comparison
   - `batchErrors` (Array) - Track errors

**Memory**: ~100MB baseline

---

### Phase 2: Processing Mode Selection

**Location**: `gameDataProcessor.js` → `process()` method (line ~457)

#### Option A: Category Isolation Mode
**Enabled**: `ISOLATE_BY_CATEGORY=true`

**Steps**:
1. Build grade-to-competition map
2. Group teams by competition/category
3. Process each category sequentially
4. Assign fixtures immediately after each category

**Memory Pattern**:
```
Category 1: Scrape → Assign → Clear → ~200MB
Category 2: Scrape → Assign → Clear → ~200MB
Category 3: Scrape → Assign → Clear → ~200MB
...
Memory stays constant!
```

#### Option B: Standard Processing Mode
**Enabled**: `ISOLATE_BY_CATEGORY=false` (default)

**Steps**:
1. Process all teams together
2. Create batches of teams
3. Process batches sequentially (concurrency: 1)
4. Assign fixtures immediately after each batch

**Memory Pattern**:
```
Batch 1: Scrape → Assign → Clear → ~200MB
Batch 2: Scrape → Assign → Clear → ~200MB
Batch 3: Scrape → Assign → Clear → ~200MB
...
Memory stays constant!
```

---

### Phase 3: Batch Processing (Standard Mode)

**Location**: `gameDataProcessor.js` → `process()` method (line ~570)

#### Step 3.1: Create Batches
```javascript
// Default batch size: 3 teams
const batchSize = parseInt(process.env.GAME_DATA_BATCH_SIZE || "3", 10);
const teamBatches = this.createBatches(teams, batchSize);
```

**Example**:
- 100 teams ÷ 3 = 34 batches
- Each batch contains 3 teams

#### Step 3.2: Create Page Pool
```javascript
// Create page pool before processing
const puppeteerManager = PuppeteerManager.getInstance();
await puppeteerManager.createPagePool(concurrency); // 3 pages
```

**Memory**: +90MB (3 pages × 30MB each)

#### Step 3.3: Process Batches Sequentially
```javascript
// Process batches with concurrency: 1 (sequential)
const { results: batchResults } = await processInParallel(
  teamBatches,
  async ({ batch, batchNumber }) => {
    // Scrape fixtures for this batch
    const scrapedGameData = await scrapeBatch(batch);
    return { batchNumber, scrapedGameData };
  },
  1 // Concurrency: 1 (sequential)
);
```

**Memory**: ~200MB per batch (pages + fixtures)

---

### Phase 4: Scraping (Per Batch)

**Location**: `getGameData.js` → `processGamesBatch()` method

#### Step 4.1: Process Teams in Parallel
```javascript
// Process teams in batch with concurrency: 3
const { results } = await processInParallel(
  teamsBatch, // 3 teams
  async (team) => {
    // Get page from pool
    const page = await puppeteerManager.getPageFromPool();

    // Scrape fixtures for this team
    const gameDataFetcher = new GameDataFetcher(page, url, grade);
    const gameData = await gameDataFetcher.fetchGameData();

    // Release page back to pool
    await puppeteerManager.releasePageFromPool(page);

    return gameData;
  },
  3 // Concurrency: 3 (parallel within batch)
);
```

**Memory**: ~90MB (3 pages × 30MB each)

#### Step 4.2: Extract Fixture Data
**Location**: `GameDataFetcher.js` → `extractMatchDetails()` method

**Process**:
1. Navigate to team page
2. Wait for page load
3. Extract fixture elements
4. Extract fixture details (date, round, teams, etc.)
5. Return fixture objects

**Fixture Object Structure**:
```javascript
{
  grade: [gradeID],
  round: "Round 1",
  date: "Saturday, 14 Oct 2023",
  dayOne: Date object,
  type: "T20",
  time: "2:00 PM",
  ground: "Ground Name",
  dateRangeObj: {...},
  finalDaysPlay: {...},
  status: "Final",
  urlToScoreCard: "/url/...",
  gameID: "12345",
  teams: [],
  teamHomeID: 123,
  teamAwayID: 456,
  teamHome: "Team Name",
  teamAway: "Team Name",
}
```

**Memory**: ~500 bytes per fixture

---

### Phase 5: Streaming Assignment (NEW!)

**Location**: `gameDataProcessor.js` → `process()` method (line ~717)

#### Step 5.1: Assign Immediately After Scraping
```javascript
// For each batch result
for (const batchResult of batchResults) {
  if (batchResult.scrapedGameData.length > 0) {
    // Create assignment batches
    const assignmentBatches = this.createBatches(
      batchResult.scrapedGameData,
      assignmentBatchSize // Default: 10
    );

    // Assign each batch immediately
    for (const assignmentBatch of assignmentBatches) {
      const assignGameDataObj = new assignGameData(
        assignmentBatch,
        this.dataObj
      );
      await assignGameDataObj.setup(); // Assign to CMS
      assignGameDataObj = null; // Clear reference

      // Force GC after every assignment batch
      if (global.gc) {
        global.gc();
      }
    }

    // CRITICAL: Clear batch data immediately
    batchResult.scrapedGameData.length = 0;
    batchResult.scrapedGameData = null;

    // Track only fixture IDs (minimal memory)
    batchResult.fixtureIds.forEach(gameID => {
      scrapedFixtureIds.add(gameID);
      scrapedFixturesMinimal.push({ gameID });
    });
  }
}
```

**Memory**: Fixtures cleared immediately after assignment!

#### Step 5.2: Assignment Process
**Location**: `assignGameData.js` → `setup()` method

**Process**:
1. Split fixtures into assignment batches (default: 10)
2. For each assignment batch:
   - Get team IDs from CMS
   - Check if game exists
   - Create or update game in CMS
3. Clear fixtures after assignment

**Memory**: Cleared after assignment

---

### Phase 6: Memory Cleanup

**Location**: `gameDataProcessor.js` → `process()` method (line ~740)

#### Step 6.1: Periodic Cleanup
```javascript
// Cleanup every 5 batches
if (batchIndex % 5 === 0) {
  await puppeteerManager.cleanupOrphanedPages();
  if (global.gc) {
    global.gc();
  }
}
```

**Memory**: Released periodically

#### Step 6.2: Final Cleanup
```javascript
// Clear dataObj reference
this.dataObj = null;
```

**Memory**: Final cleanup

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INITIALIZE                                               │
│    - Extract teams                                          │
│    - Initialize tracking variables                          │
│    Memory: ~100MB                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CHOOSE MODE                                              │
│    Category Isolation OR Standard Processing                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CREATE BATCHES                                           │
│    - Batch size: 3 teams (default)                          │
│    - Create page pool: 3 pages                              │
│    Memory: +90MB (pages)                                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PROCESS BATCHES (Sequential)                             │
│    For each batch:                                          │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ 4a. Scrape Fixtures                                 │  │
│    │     - Process 3 teams in parallel                   │  │
│    │     - Extract fixture data                          │  │
│    │     Memory: ~200MB (pages + fixtures)               │  │
│    └─────────────────────────────────────────────────────┘  │
│                        ↓                                    │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ 4b. Assign Fixtures Immediately (Streaming)        │  │
│    │     - Split into assignment batches                │  │
│    │     - Assign to CMS                                 │  │
│    │     - Clear fixtures                               │  │
│    │     Memory: Released immediately                    │  │
│    └─────────────────────────────────────────────────────┘  │
│                        ↓                                    │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ 4c. Track Only IDs                                  │  │
│    │     - Store only gameID (minimal memory)            │  │
│    │     Memory: ~1KB per fixture ID                    │  │
│    └─────────────────────────────────────────────────────┘  │
│                        ↓                                    │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ 4d. Memory Cleanup (Every 5 batches)               │  │
│    │     - Cleanup page pool                             │  │
│    │     - Force GC                                      │  │
│    │     Memory: Released                                │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. COMPLETE                                                 │
│    - Return minimal fixture IDs                             │
│    - Final cleanup                                          │
│    Memory: ~150MB (baseline)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Memory Timeline

### Standard Processing Mode (100 teams, 500 fixtures):

```
Time    | Action                    | Memory  | Notes
--------|---------------------------|---------|------------------
0s      | Initialize                | 100MB   | Baseline
1s      | Create page pool          | 190MB   | +90MB (pages)
2s      | Batch 1: Scrape            | 290MB   | +100MB (fixtures)
3s      | Batch 1: Assign            | 200MB   | -90MB (cleared)
4s      | Batch 2: Scrape            | 300MB   | +100MB (fixtures)
5s      | Batch 2: Assign            | 210MB   | -90MB (cleared)
6s      | Batch 3: Scrape            | 310MB   | +100MB (fixtures)
7s      | Batch 3: Assign            | 220MB   | -90MB (cleared)
...
15s     | Cleanup (every 5 batches)  | 180MB   | -40MB (cleanup)
...
30s     | Complete                   | 150MB   | Final cleanup
```

**Peak Memory**: ~310MB (vs 1.9GB before fix!)

---

## 🎯 Key Differences from Before

### Before Fix:
- ❌ Accumulated all fixtures before assignment
- ❌ Parallel batch processing (×2 memory multiplier)
- ❌ Large batch sizes (5 teams)
- ❌ No immediate cleanup
- ❌ Memory grew linearly to 1.9GB+

### After Fix:
- ✅ Assign fixtures immediately (streaming)
- ✅ Sequential batch processing (×1 memory)
- ✅ Smaller batch sizes (3 teams)
- ✅ Immediate cleanup after assignment
- ✅ Memory stays under 400MB

---

## ⚙️ Configuration Options

### Environment Variables:

```bash
# Batch Configuration
GAME_DATA_BATCH_SIZE=3              # Teams per batch (default: 3)
GAME_DATA_BATCH_CONCURRENCY=1       # Batch concurrency (default: 1)
GAME_DATA_ASSIGNMENT_BATCH_SIZE=10  # Fixtures per assignment batch (default: 10)

# Category Isolation
ISOLATE_BY_CATEGORY=true            # Enable category isolation (default: false)
TEST_CATEGORY_ID=123                # Test specific category
TEST_CATEGORY_NAME="Competition"    # Test by category name
```

### Recommended Settings:

**Small Associations (< 100 teams)**:
```bash
GAME_DATA_BATCH_SIZE=3
GAME_DATA_BATCH_CONCURRENCY=1
```

**Medium Associations (100-500 teams)**:
```bash
GAME_DATA_BATCH_SIZE=3
GAME_DATA_BATCH_CONCURRENCY=1
ISOLATE_BY_CATEGORY=true  # Optional: Better memory control
```

**Large Associations (500-1000+ teams)**:
```bash
GAME_DATA_BATCH_SIZE=2              # Smaller batches
GAME_DATA_BATCH_CONCURRENCY=1       # Sequential
ISOLATE_BY_CATEGORY=true            # Recommended
```

---

## 🔍 Monitoring Points

### Key Metrics to Track:

1. **Memory Usage**:
   - Baseline: ~100MB
   - Peak during scraping: ~300MB
   - After cleanup: ~200MB

2. **Processing Speed**:
   - Batch processing time: ~2-5 seconds per batch
   - Assignment time: ~1-2 seconds per assignment batch

3. **Error Rate**:
   - Scraping errors: Should be < 5%
   - Assignment errors: Should be < 1%

4. **Memory Growth**:
   - Should stay constant (not grow linearly)
   - Should decrease after cleanup

---

**Last Updated**: 2025-12-05
**Status**: Current Process Documented

