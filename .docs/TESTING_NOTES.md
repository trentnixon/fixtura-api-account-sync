# Testing Notes - Commented Out Code

This document tracks code that has been temporarily commented out for testing purposes and needs to be restored after testing is complete.

## Date: 2025-12-02

### Purpose
Testing competitions scraping with refactored PuppeteerManager. Commented out other stages to isolate and debug competitions processing.

---

## Commented Out Sections

### 1. Teams Stage (`dataProcessing/controllers/dataController.js`)

**Location:** Lines ~141-168

**What was commented:**
- Entire Teams processing stage
- `ProcessTeams(dataObj)` call
- Stage tracking (setCurrentStage, completeStage)
- Data refresh after teams stage

**Status:** ✅ Commented out (tested successfully ✅)

**To Restore:**
- Uncomment lines ~141-168 in `dataController.js`
- Ensure Teams stage runs after Competitions stage completes

---

### 2. Games Stage (`dataProcessing/controllers/dataController.js`)

**Location:** Lines ~170-200

**What was commented:**
- Entire Games processing stage
- `ProcessGames(dataObj)` call
- Stage tracking (setCurrentStage, completeStage)
- Browser restart after games stage
- Data refresh after games stage
- Scraped fixtures storage

**Status:** ✅ Commented out (tested successfully ✅)

**To Restore:**
- Uncomment lines ~170-200 in `dataController.js`
- Ensure Games stage runs after Teams stage completes
- Note: Games stage stores `scrapedFixtures` which is used by Fixture Cleanup stage

---

### 3. Fixture Validation Stage (`dataProcessing/controllers/dataController.js`)

**Location:** Lines ~205-240

**What was commented:**
- Entire Fixture Validation processing stage
- `ProcessFixtureValidation(dataObj)` call
- Stage tracking (setCurrentStage, completeStage)
- Validation results storage

**Status:** ✅ Commented out (tested successfully ✅)

**To Restore:**
- Uncomment lines ~205-240 in `dataController.js`
- Ensure Fixture Validation stage runs after Games stage completes
- Note: Validation results are used by Fixture Cleanup stage

---

### 4. Fixture Cleanup Stage (`dataProcessing/controllers/dataController.js`)

**Location:** Lines ~242-273

**What was commented:**
- Entire Fixture Cleanup processing stage
- `ProcessFixtureCleanup(dataObj)` call
- Stage tracking (setCurrentStage, completeStage)
- Cleanup results tracking

**Status:** ✅ Currently Active (testing in progress)

**To Restore:**
- Already active for testing
- Will be commented out again after testing
- Note: Requires `scrapedFixtures` from Games stage and validation results from Fixture Validation stage

---

## Current Active Stages

1. ✅ **Competitions Stage** - Active (end-to-end test)
2. ✅ **Teams Stage** - Active (end-to-end test)
3. ✅ **Games Stage** - Active (end-to-end test)
4. ✅ **Fixture Validation Stage** - Active (end-to-end test)
5. ✅ **Fixture Cleanup Stage** - Active (end-to-end test)
6. ✅ **ProcessTracking** - Active (runs at end)

**Status:** All stages uncommented for end-to-end testing ✅

**Note:** All stages are now active and will run in sequence:
1. Competitions → 2. Teams → 3. Games → 4. Fixture Validation → 5. Fixture Cleanup → 6. ProcessTracking

---

## Testing Focus

**Current Test:** Fixture Cleanup with refactored PuppeteerManager

**Previous Tests:**
- ✅ Competitions scraping - Successfully tested (3 competitions scraped and sent to CMS)
- ✅ Teams scraping - Successfully tested (teams scraped and sent to CMS)
- ✅ Games scraping - Successfully tested (fixtures scraped and sent to CMS)
- ✅ Fixture Validation - Successfully tested (validation results logged)

**Added Logging:**
- `dataProcessing/processors/competitionProcessor.js` - Logs scraped competitions data before CMS ✅
- `dataProcessing/processors/teamProcessor.js` - Logs scraped teams data before CMS ✅
- `dataProcessing/processors/gameDataProcessor.js` - Logs scraped fixtures data before CMS ✅
- `dataProcessing/controllers/dataController.js` - Logs validation results before use ✅
- `dataProcessing/controllers/dataController.js` - Logs cleanup results before deletion (NEW)
- `dataProcessing/scrapeCenter/Competitions/getCompetitions.js` - Enhanced error logging ✅
- `dataProcessing/scrapeCenter/Competitions/AssociationCompetitionsFetcher.js` - Step-by-step logging ✅

---

## Restoration Checklist

When testing is complete, restore in this order:

- [ ] **Step 1:** Uncomment Teams stage
- [ ] **Step 2:** Uncomment Games stage
- [ ] **Step 3:** Uncomment Fixture Validation stage
- [ ] **Step 4:** Uncomment Fixture Cleanup stage
- [ ] **Step 5:** Verify all stages run in correct sequence
- [ ] **Step 6:** Test full pipeline end-to-end
- [ ] **Step 7:** Remove or reduce debug logging if no longer needed

---

## Notes

- All commented code is marked with `// COMMENTED OUT FOR TESTING`
- ProcessTracking stage remains active to track processing stats
- Data refresh calls are also commented out between stages (these may need to be restored)
- Browser restart after games stage is commented out (may need to be restored)

---

## File Locations

- **Main Controller:** `dataProcessing/controllers/dataController.js`
- **Competitions Processor:** `dataProcessing/processors/competitionProcessor.js`
- **Competitions Scraper:** `dataProcessing/scrapeCenter/Competitions/getCompetitions.js`
- **Competitions Fetcher:** `dataProcessing/scrapeCenter/Competitions/AssociationCompetitionsFetcher.js`

