# Category Isolation - Order of Operations

**Date:** 2025-12-04
**Purpose:** Step-by-step flow of how category isolation processes game data

---

## 🔄 Complete Flow (Start to Finish)

### **Phase 1: Initialization**

1. **GameDataProcessor Created**
   ```
   new GameDataProcessor(dataObj, { isolateByCategory: true, memoryTracker: tracker })
   ```

2. **Check if Isolation Enabled**
   - Reads `ISOLATE_BY_CATEGORY` env var or options
   - If `false` → Skip to standard processing (all teams together)
   - If `true` → Continue to Phase 2

---

### **Phase 2: Category Grouping**

3. **Build Grade-to-Competition Map**
   ```
   buildGradeToCompetitionMap()
   ```
   - Iterates through `dataObj.Grades` array
   - Creates Map: `gradeId → { compID, compName }`
   - Logs: `[GAMES] Built grade-to-competition map: X grades mapped`

4. **Group Teams by Category**
   ```
   groupTeamsByCategory(teams, gradeToCompMap)
   ```
   - Iterates through `dataObj.TEAMS` array
   - For each team:
     - Gets `team.grade` (grade ID)
     - Looks up competition info from map
     - Groups teams by competition name + ID
   - Logs: `[GAMES] Grouped X teams into Y categories`
   - Logs each category: `[GAMES] Category: Name (ID: 123) - Z teams`

5. **Apply Test Filter (if set)**
   - Checks `TEST_CATEGORY_ID` or `TEST_CATEGORY_NAME` env vars
   - Filters categories to match filter
   - If no match → Error with list of available categories
   - Logs: `[GAMES] TEST_CATEGORY filter active: Processing X of Y categories`

---

### **Phase 3: Category Processing Loop**

For each category (sequentially):

6. **Log Category Start**
   ```
   [GAMES] [CATEGORY-1/5] Processing category: Competition Name (25 teams)
   ```

7. **Log Memory Before**
   ```
   [CATEGORY-1] Memory Usage: rss: 450.23 MB, heapUsed: 320.15 MB
   ```

8. **Create Batches**
   - Splits category's teams into batches (default: 5 teams per batch)
   - Logs: `[GAMES] [CATEGORY-1] Processing X batches (batch size: 5, concurrency: 2)`

9. **Create Page Pool** (if needed)
   - Checks if page pool exists
   - Creates pool if empty
   - Logs: `[GAMES] [CATEGORY-1] Creating page pool of size X`

10. **Process Batches in Parallel**
    - Uses `processInParallel()` with concurrency limit (default: 2)
    - For each batch:
      - Creates `getTeamsGameData` instance
      - Calls `setup()` to scrape game data
      - Extracts fixture IDs
      - Logs: `[GAMES] [CATEGORY-1] [BATCH-1] Processing X teams`
    - Aggregates results from all batches

11. **Log Category Complete**
    ```
    [GAMES] [CATEGORY-1] Completed in 12500ms - 150 fixtures scraped
    ```

12. **Log Memory After**
    ```
    [CATEGORY-1-COMPLETE] Memory Usage: rss: 680.45 MB, heapUsed: 520.30 MB
    ```
    - Warns if memory is high: `[GAMES] [CATEGORY-1] Memory is high (680.45 MB)`

13. **Cleanup Between Categories** (except last category)
    ```
    [GAMES] [CATEGORY-1] Starting memory cleanup
    ```
    - Checks if memory is high
    - If high → Forces browser restart
    - Cleans up orphaned pages
    - Triggers garbage collection (if available)
    - Logs: `[GAMES] [CATEGORY-1] Memory cleanup completed`

14. **Repeat for Next Category**
    - Goes back to step 6 for next category
    - Continues until all categories processed

---

### **Phase 4: Aggregation**

15. **Aggregate All Category Results**
    - Combines `scrapedGameData` from all categories
    - Combines `fixtureIds` from all categories (using Set to avoid duplicates)
    - Creates `scrapedFixturesMinimal` array with `{ gameID }` objects

---

### **Phase 5: Assignment**

16. **Create Assignment Batches**
    - Splits all scraped game data into assignment batches (default: 10 fixtures per batch)
    - Logs: `[GAMES] Assigning X fixtures in Y assignment batches`

17. **Assign to CMS Sequentially**
    - For each assignment batch:
      - Creates `assignGameData` instance
      - Calls `setup()` to assign fixtures
      - Logs: `[GAMES] Assigning batch X/Y (Z fixtures)`
      - Clears references after processing
      - Triggers GC every 2 batches

18. **Clear Scraped Data**
    - Clears `allScrapedGameData` array
    - Logs: `[GAMES] Scraped X unique fixtures total across Y batches`

---

### **Phase 6: Return Results**

19. **Return Minimal Fixtures**
    ```javascript
    return {
      process: true,
      scrapedFixtures: scrapedFixturesMinimal  // Array of { gameID } objects
    }
    ```

---

## 📊 Visual Flow Diagram

```
START
  │
  ├─ Check ISOLATE_BY_CATEGORY
  │   ├─ false → Standard Processing (all teams together)
  │   └─ true → Category Isolation
  │
  ├─ Build Grade-to-Competition Map
  │   └─ Map: gradeId → { compID, compName }
  │
  ├─ Group Teams by Category
  │   └─ Map: categoryName → { compID, compName, teams[] }
  │
  ├─ Apply Test Filter (if TEST_CATEGORY_ID/NAME set)
  │   └─ Filter categories to match
  │
  └─ FOR EACH CATEGORY (sequentially):
      │
      ├─ Log Start + Memory Before
      │
      ├─ Create Batches
      │   └─ Split teams into batches
      │
      ├─ Create Page Pool (if needed)
      │
      ├─ Process Batches in Parallel
      │   ├─ Batch 1 → Scrape → Extract IDs
      │   ├─ Batch 2 → Scrape → Extract IDs
      │   └─ Aggregate Results
      │
      ├─ Log Complete + Memory After
      │
      ├─ Cleanup (if not last category)
      │   ├─ Check Memory
      │   ├─ Restart Browser (if high)
      │   ├─ Cleanup Pages
      │   └─ Trigger GC
      │
      └─ Next Category
  │
  ├─ Aggregate All Category Results
  │   └─ Combine scrapedGameData + fixtureIds
  │
  ├─ Create Assignment Batches
  │
  ├─ Assign to CMS Sequentially
  │   └─ For each batch: assign → clear → GC (every 2 batches)
  │
  └─ Return Results
      └─ { process: true, scrapedFixtures: [...] }
```

---

## 🔍 Key Points

### **Sequential Category Processing**
- Categories are processed **one at a time** (not in parallel)
- This allows memory cleanup between categories
- Prevents memory accumulation across all categories

### **Parallel Batch Processing**
- Within each category, **batches are processed in parallel**
- Default: 2 batches concurrently
- Each batch processes 5 teams (default)

### **Memory Management**
- Memory logged before/after each category
- Browser restart triggered if memory exceeds threshold
- Cleanup happens between categories (not after last one)

### **Test Filtering**
- `TEST_CATEGORY_ID` or `TEST_CATEGORY_NAME` filters to one category
- If filter doesn't match → Error with available categories list
- Useful for testing/debugging specific categories

---

## 📝 Example Log Sequence

```
[GAMES] Category isolation enabled - processing one category at a time
[GAMES] Built grade-to-competition map: 15 grades mapped
[GAMES] Grouped 120 teams into 5 categories (0 ungrouped)
[GAMES] Category: Summer Competition (ID: 123) - 25 teams
[GAMES] Category: Winter League (ID: 456) - 30 teams
[GAMES] Category: Spring Tournament (ID: 789) - 20 teams
[GAMES] Category: Fall Championship (ID: 101) - 25 teams
[GAMES] Category: All-Star Series (ID: 202) - 20 teams
[GAMES] Processing 5 categories sequentially

[GAMES] [CATEGORY-1/5] Processing category: Summer Competition (25 teams)
[CATEGORY-1] Memory Usage: rss: 450.23 MB, heapUsed: 320.15 MB (Peak: 450.23 MB)
[GAMES] [CATEGORY-1] Processing 5 batches (batch size: 5, concurrency: 2)
[GAMES] [CATEGORY-1] [BATCH-1] Processing 5 teams
[GAMES] [CATEGORY-1] [BATCH-2] Processing 5 teams
...
[GAMES] [CATEGORY-1] Completed in 12500ms - 150 fixtures scraped
[CATEGORY-1-COMPLETE] Memory Usage: rss: 680.45 MB, heapUsed: 520.30 MB (Peak: 680.45 MB)
[GAMES] [CATEGORY-1] Starting memory cleanup
[GAMES] [CATEGORY-1] Memory cleanup completed

[GAMES] [CATEGORY-2/5] Processing category: Winter League (30 teams)
[CATEGORY-2] Memory Usage: rss: 420.10 MB, heapUsed: 310.50 MB (Peak: 680.45 MB)
...
```

---

## ⚙️ Configuration Order

1. **Environment Variables** (checked first)
   - `ISOLATE_BY_CATEGORY=true`
   - `TEST_CATEGORY_ID=123` (optional)
   - `TEST_CATEGORY_NAME="Summer"` (optional)
   - `GAME_DATA_BATCH_SIZE=5`
   - `GAME_DATA_BATCH_CONCURRENCY=2`
   - `MEMORY_THRESHOLD_MB=1800`
   - `MEMORY_CRITICAL_MB=1900`

2. **Options Object** (passed to constructor)
   - `isolateByCategory: true`
   - `memoryTracker: instance`

3. **Defaults** (if not set)
   - Batch size: 5
   - Concurrency: 2
   - Memory threshold: 1800 MB
   - Memory critical: 1900 MB

