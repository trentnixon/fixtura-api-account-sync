# Category Testing Plan - Memory Investigation

**Date:** 2025-12-04
**Goal:** Test categories one by one to identify memory issues

---

## 🎯 Testing Strategy

### Step 1: Enable Category Isolation
```bash
ISOLATE_BY_CATEGORY=true
```

### Step 2: Test Categories One by One

For each category, we'll:
1. Set `TEST_CATEGORY_ID` or `TEST_CATEGORY_NAME` to isolate one category
2. Run the scraper
3. Check memory logs before/after
4. Identify which category causes memory spikes

---

## 📋 Testing Checklist

### Category 1: [First Competition]
- [ ] Set `TEST_CATEGORY_ID=<first_comp_id>` or `TEST_CATEGORY_NAME="<first_comp_name>"`
- [ ] Run scraper
- [ ] Check logs for:
  - Memory BEFORE category starts
  - Memory AFTER category completes
  - Memory INCREASE during processing
  - Any warnings/critical alerts
- [ ] Document results

### Category 2: [Second Competition]
- [ ] Repeat above steps
- [ ] Compare memory usage with Category 1

### Continue for all categories...

---

## 🔍 What to Look For in Logs

### Memory Metrics
```
[GAMES] [CATEGORY-1] Memory BEFORE: RSS=450.23 MB, Heap=320.15 MB
[GAMES] [CATEGORY-1] Memory AFTER: RSS=680.45 MB, Heap=520.30 MB
[GAMES] [CATEGORY-1] Memory INCREASE: 230.22 MB
```

### Warning Indicators
- `MEMORY WARNING` - Memory exceeds threshold (default: 1800 MB)
- `MEMORY CRITICAL` - Memory exceeds critical threshold (default: 1900 MB)
- Large memory increases (>500 MB per category)

### Performance Metrics
- Duration per category
- Number of fixtures scraped
- Number of teams processed

---

## 📊 Log Format

When you run with `ISOLATE_BY_CATEGORY=true`, you'll see:

```
[GAMES] ===== AVAILABLE CATEGORIES FOR TESTING =====
[GAMES] [1] Category: Competition Name (ID: 123) - 25 teams
[GAMES] [2] Category: Another Competition (ID: 456) - 30 teams
[GAMES] ===== END CATEGORY LIST =====
[GAMES] To test a specific category, set: TEST_CATEGORY_ID=123 (or use TEST_CATEGORY_NAME)
```

Then when processing:

```
[GAMES] ========================================
[GAMES] [CATEGORY-1/5] STARTING: Competition Name
[GAMES] [CATEGORY-1] Competition ID: 123
[GAMES] [CATEGORY-1] Teams to process: 25
[GAMES] ========================================
[CATEGORY-1-START] Memory Usage: rss: 450.23 MB, heapUsed: 320.15 MB
[GAMES] [CATEGORY-1] Memory BEFORE: RSS=450.23 MB, Heap=320.15 MB
...
[GAMES] [CATEGORY-1] Completed in 12500ms - 150 fixtures scraped
[CATEGORY-1-COMPLETE] Memory Usage: rss: 680.45 MB, heapUsed: 520.30 MB
[GAMES] [CATEGORY-1] Memory AFTER: RSS=680.45 MB, Heap=520.30 MB
[GAMES] [CATEGORY-1] Memory INCREASE: 230.22 MB
[GAMES] ========================================
```

---

## 🚀 Quick Start Commands

### Test First Category
```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_ID=123  # Replace with actual ID from logs
```

### Test by Name
```bash
ISOLATE_BY_CATEGORY=true
TEST_CATEGORY_NAME="Competition Name"  # Partial match works
```

### Test All Categories (Sequentially)
```bash
ISOLATE_BY_CATEGORY=true
# Don't set TEST_CATEGORY_ID or TEST_CATEGORY_NAME
```

---

## 📝 Results Template

### Category: [Name] (ID: [ID])
- **Teams:** X
- **Fixtures Scraped:** Y
- **Duration:** Z ms
- **Memory Before:** X MB
- **Memory After:** Y MB
- **Memory Increase:** Z MB
- **Status:** ✅ Normal / ⚠️ Warning / 🚨 Critical
- **Notes:** [Any observations]

---

## 🎯 Next Steps After Testing

1. **Identify Problem Categories**
   - Which categories cause memory spikes?
   - Which categories exceed thresholds?

2. **Analyze Patterns**
   - Do larger categories (more teams) use more memory?
   - Do certain competition types cause issues?
   - Is memory released properly between categories?

3. **Fix Issues**
   - Optimize problematic categories
   - Adjust batch sizes for specific categories
   - Add additional cleanup steps

---

## 💡 Tips

1. **Start with first category** - Get baseline memory usage
2. **Compare sequentially** - See if memory accumulates or resets
3. **Check cleanup** - Verify memory drops after cleanup between categories
4. **Document everything** - Keep notes on which categories cause issues

