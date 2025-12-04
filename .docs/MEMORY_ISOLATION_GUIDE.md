# Memory Isolation Guide - Category-by-Category Processing

**Date:** 2025-12-04
**Purpose:** Isolate memory issues by processing one category/competition at a time

---

## 🎯 Overview

This feature allows you to process game data **one category (competition) at a time** instead of processing all teams together. This helps:

1. **Identify memory issues** - See which category causes memory spikes
2. **Isolate problems** - Run one category in the cloud to find bottlenecks
3. **Prevent OOM errors** - Clean up memory between categories

---

## 🚀 How to Enable

### Environment Variable

Set the following environment variable to enable category isolation:

```bash
ISOLATE_BY_CATEGORY=true
```

### Test a Specific Category

To test **only one category** instead of all categories:

**Option 1: Filter by Competition ID**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123  # Process only competition with ID 123
```

**Option 2: Filter by Competition Name (partial match)**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_NAME="Summer Competition"  # Process categories containing this name
```

**Note:** If no category matches the filter, you'll see an error listing all available categories.

### In Code

You can also pass it as an option when creating `GameDataProcessor`:

```javascript
const gameDataProcessor = new GameDataProcessor(dataObj, {
  isolateByCategory: true,
  memoryTracker: memoryTrackerInstance,
});
```

---

## 📊 How It Works

### 1. **Category Grouping**

Teams are grouped by competition/category using the grade-to-competition mapping:

- Each team has a `grade` field (grade ID)
- Grades are linked to competitions via `compID` and `compName`
- Teams are grouped by their competition

### 2. **Sequential Processing**

Categories are processed **one at a time** (sequentially):

```
Category 1 → Process → Cleanup → Category 2 → Process → Cleanup → ...
```

### 3. **Memory Monitoring**

Memory is logged:

- **Before** each category starts
- **After** each category completes
- **During** cleanup between categories

### 4. **Automatic Cleanup**

Between categories, the system:

- Checks memory usage
- Forces browser restart if memory is high (≥ threshold)
- Cleans up orphaned pages
- Triggers garbage collection (if available)

---

## 📝 Logging

### Category Processing Logs

```
[GAMES] Category isolation enabled - processing one category at a time
[GAMES] Built grade-to-competition map: 15 grades mapped
[GAMES] Grouped 120 teams into 5 categories (0 ungrouped)
[GAMES] Category: Competition Name (ID: 123) - 25 teams
[GAMES] Processing 5 categories sequentially
[GAMES] [CATEGORY-1/5] Processing category: Competition Name (25 teams)
[CATEGORY-1] Memory Usage: rss: 450.23 MB, heapUsed: 320.15 MB (Peak: 450.23 MB)
[GAMES] [CATEGORY-1] Processing 5 batches (batch size: 5, concurrency: 2)
[GAMES] [CATEGORY-1] Completed in 12500ms - 150 fixtures scraped
[CATEGORY-1-COMPLETE] Memory Usage: rss: 680.45 MB, heapUsed: 520.30 MB (Peak: 680.45 MB)
[GAMES] [CATEGORY-1] Starting memory cleanup
[GAMES] [CATEGORY-1] Memory cleanup completed
```

### Memory Warnings

If memory exceeds thresholds:

```
[CATEGORY-2] MEMORY WARNING: rss: 1850.23 MB, heapUsed: 1200.15 MB (Peak: 1850.23 MB)
[GAMES] [CATEGORY-2] Memory is high (1850.23 MB) - consider browser restart
[GAMES] [CATEGORY-2] Memory is high - forcing browser restart
```

---

## ⚙️ Configuration

### Memory Thresholds

Set memory warning and critical thresholds:

```bash
MEMORY_THRESHOLD_MB=1800  # Warning threshold (default: 1800 MB)
MEMORY_CRITICAL_MB=1900   # Critical threshold (default: 1900 MB)
```

### Batch Configuration

Category processing uses the same batch settings as standard processing:

```bash
GAME_DATA_BATCH_SIZE=5              # Teams per batch
GAME_DATA_BATCH_CONCURRENCY=2       # Parallel batches
```

---

## 🔍 Troubleshooting

### No Categories Found

If you see:

```
[GAMES] No categories found - falling back to standard processing
```

**Possible causes:**

- `dataObj.Grades` is missing or empty
- Grades don't have `compID` field
- Teams don't have `grade` field

**Solution:** Check that your data structure includes:

- `dataObj.Grades` array with `{ id, compID, compName }`
- `dataObj.TEAMS` array with `{ grade }` field

### Memory Still High

If memory continues to grow even with isolation:

1. **Reduce batch size:**

   ```bash
   GAME_DATA_BATCH_SIZE=3
   ```

2. **Reduce concurrency:**

   ```bash
   GAME_DATA_BATCH_CONCURRENCY=1
   ```

3. **Enable browser restart after each category:**
   - Modify `cleanupBetweenCategories()` to always restart browser

### Category Processing Fails

If a category fails:

- Error is logged with category details
- Processing **stops** (doesn't continue to next category)
- Check logs for specific error message

---

## 📈 Expected Behavior

### With Isolation Enabled

- **Memory:** Should stabilize between categories (cleanup resets memory)
- **Time:** Slightly slower (sequential processing vs parallel)
- **Reliability:** Higher (memory issues isolated to one category)

### Without Isolation (Standard)

- **Memory:** May accumulate across all teams
- **Time:** Faster (parallel processing)
- **Reliability:** Lower (one failure affects all)

---

## 🧪 Testing

### Test One Category

**Method 1: Environment Variable (Recommended)**

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123  # Replace 123 with your competition ID
```

Or filter by name:

```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_NAME="Summer Competition"
```

**Method 2: Check Logs for Available Categories**

When you run with `ISOLATE_BY_CATEGORY=true`, the logs will show:

```
[GAMES] Category: Competition Name (ID: 123) - 25 teams
[GAMES] Category: Another Competition (ID: 456) - 30 teams
```

Use the ID or name from the logs in your `TEST_CATEGORY_ID` or `TEST_CATEGORY_NAME` filter.

### Cloud Testing

1. Enable isolation: `ISOLATE_BY_CATEGORY=true`
2. Deploy to cloud
3. Monitor logs for:
   - Category breakdown
   - Memory usage per category
   - Which category causes memory spike

---

## 📚 Related Files

- `dataProcessing/processors/gameDataProcessor.js` - Main processor with isolation logic
- `dataProcessing/utils/memoryTracker.js` - Enhanced memory tracking
- `dataProcessing/controllers/components/stages/gameProcessor.js` - Component wrapper

---

## 💡 Tips

1. **Start with isolation enabled** to identify problematic categories
2. **Check logs** for memory spikes per category
3. **Adjust batch sizes** if a specific category is problematic
4. **Disable isolation** once memory issues are resolved (for better performance)
