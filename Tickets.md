# Completed Tickets

- TKT-2025-005

---

# Active Tickets

## TKT-2025-006 – Fixture Deletion and 404 Error Handling

---

ID: TKT-2025-006
Status: In Progress (Phases 2, 3, 4 Complete; Phase 5 Partially Complete; Phase 1 Pending)
Priority: High
Owner: Development Team
Created: 2025-11-11
Updated: 2025-11-11
Related: Roadmap-Fixture-Deletion-404-Handling

**Progress Summary**:
- ✅ Phase 2: Existing Fixture Validation - COMPLETED
- ✅ Phase 3: Comparison Logic - COMPLETED
- ✅ Phase 4: Deletion Functionality - COMPLETED
- ⏳ Phase 5: Integration and Testing - PARTIALLY COMPLETED (logging done, tests pending)
- ⏳ Phase 1: 404 Error Handling in Scrapers - NOT STARTED

**Current Status**: Core functionality is working. Validation, comparison, and deletion are implemented and tested. Next steps: Re-enable full processing flow, add 404 error handling in scrapers, and complete testing/documentation.

---

## Overview

Implement comprehensive handling for missing fixtures (404 errors) and automatic deletion of fixtures that no longer exist on the source website. Currently, the system only creates/updates fixtures but doesn't detect or remove fixtures that have been removed from PlayHQ.

## What We Need to Do

Add functionality to detect when fixtures are no longer available on the source website (404 errors) and automatically delete or mark as deleted fixtures that no longer exist. This includes handling 404 errors gracefully during scraping, validating existing database fixtures for URL validity, comparing scraped fixtures with existing database fixtures, and removing fixtures that are no longer present on the source.

**Key Problem**: Fixtures can change URLs or be removed by associations. If we've synced before, we have old URLs in the DB that may now return 404. We need to validate existing DB fixtures during account sync to test their validity before comparison and deletion.

## Phases & Tasks

### Phase 1: 404 Error Handling in Fetcher and Scrapers

#### Tasks

- [ ] Add 404-specific error handling in `src/utils/fetcher.js`
  - Detect 404 status codes and return appropriate error codes
  - Add option to handle 404s gracefully (return null vs throw error)
  - Log 404 errors with context (endpoint, resource ID)
- [ ] Update `GameCRUD.updateGame()` to handle 404 errors gracefully
  - Catch 404 errors when updating non-existent games
  - Log warning instead of throwing error
  - Return appropriate status indicators
- [ ] Update `api/Puppeteer/NoClubAssociations/getFixutreResults.js` to handle 404s
  - Check HTTP status when navigating to scorecard URLs
  - Handle 404 responses gracefully in `getFixtureScorecard()`
  - Mark fixtures as unavailable if scorecard returns 404
  - Log 404 errors with fixture ID and URL context
- [ ] Update scrapers to detect 404 pages
  - Add status code checking in `GameDataFetcher.fetchGameData()`
  - Handle missing fixture pages gracefully
  - Continue processing other fixtures when one returns 404

### Phase 2: Existing Fixture Validation (NEW - Critical Step) ✅ COMPLETED

#### Tasks

- [x] Add method to fetch existing fixtures from database in `GameCRUD.js`
  - ✅ Created `getFixturesForTeams()` method to fetch all fixtures for given team IDs
  - ✅ Implemented batching to handle large team lists (prevents URL length issues)
  - ✅ Added date filtering (only fixtures from today onwards)
  - ✅ Returns array of fixture objects with gameID, database ID, and `urlToScoreCard`
  - ⏳ `getFixturesForCompetition()` - Not implemented (not needed for current scope)
  - ⏳ `getFixturesForAccount()` - Not implemented (Strapi query limitations)
- [x] Create fixture URL validation service
  - ✅ Created `FixtureValidationService.js` in `dataProcessing/services/`
  - ✅ Implemented `validateFixtureUrl()` method that tests if a URL returns 404
  - ✅ Uses Puppeteer for accurate validation of JavaScript-rendered pages
  - ✅ Handles timeouts and network errors gracefully
  - ✅ Returns validation result (valid, 404, error, timeout, http_403, etc.)
  - ✅ Checks page content for 404 indicators (text, title, URL)
- [x] Create batch URL validation processor
  - ✅ Implemented `validateFixturesBatch()` method for batch processing
  - ✅ Processes fixtures sequentially using single Puppeteer page (prevents resource issues)
  - ✅ Tracks validation results (valid, invalid, errors)
  - ✅ Logs validation progress and results with comprehensive logging
- [x] Integrate validation into processing flow
  - ✅ Created `FixtureValidationProcessor.js` in `dataProcessing/processors/`
  - ✅ Fetches existing fixtures from database for teams
  - ✅ Validates all existing fixture URLs (test for 404s)
  - ✅ Marks fixtures as invalid if URLs return 404
  - ✅ Stores validation results for use in comparison phase
  - ✅ Added new processing stage in `DataController.start()`: `ProcessFixtureValidation`

### Phase 3: Comparison Logic for Missing Fixtures ✅ COMPLETED

#### Tasks

- [x] Create fixture comparison service
  - ✅ Created `FixtureComparisonService.js` in `dataProcessing/services/`
  - ✅ Implemented `compareFixtures()` method that compares scraped vs database fixtures
  - ✅ Uses validation results from Phase 2 to identify invalid fixtures
  - ✅ Returns list of fixtures that:
    - ✅ Exist in DB but not in scraped data (missing from source)
    - ✅ Exist in DB but have invalid URLs (404 errors)
  - ✅ Handles edge cases (empty scraped data, empty database data)
- [x] Integrate comparison into processing flow
  - ✅ After validation, runs comparison to identify fixtures to delete
  - ✅ Combines validation results (404s) with comparison results (missing)
  - ✅ Passes invalid and missing fixtures to deletion handler
  - ✅ Logs comparison results (found, missing, invalid, new)
  - ✅ Integrated into `ProcessFixtureCleanup` in `DataController`

### Phase 4: Deletion Functionality ✅ COMPLETED

#### Tasks

- [x] Add deletion method to `GameCRUD.js`
  - ✅ Created `deleteGame()` method that deletes fixture by ID (hard delete)
  - ✅ Created `softDeleteGame()` method that marks fixture as deleted (soft delete)
  - ✅ Supports hard delete (actual deletion) and soft delete (mark as deleted)
  - ✅ Handles deletion errors gracefully
  - ✅ Logs deletion operations with fixture details
  - ✅ Soft delete sets: `isDeleted: true`, `deletedAt: timestamp`, `deletionReason: reason`
- [x] Create fixture deletion service
  - ✅ Created `FixtureDeletionService.js` in `dataProcessing/services/`
  - ✅ Implemented batch deletion functionality (processes in batches of 10)
  - ✅ Added configuration for hard vs soft delete
  - ✅ Tracks deleted fixtures in processing tracker
  - ✅ Returns detailed deletion results (deleted, failed, skipped counts)
- [x] Add deletion configuration
  - ✅ Added config option to enable/disable automatic deletion (`deletionEnabled`)
  - ✅ Added config for hard vs soft delete preference (`deleteMode`)
  - ✅ Added config for deletion batch size (`batchSize: 10`)
  - ✅ Configuration documented in code comments
  - ✅ Currently enabled with soft delete mode (safe for production)

### Phase 5: Integration and Testing ⏳ PARTIALLY COMPLETED

#### Tasks

- [x] Integrate validation and deletion into `DataController.start()`
  - ✅ Added new processing stage: `ProcessFixtureValidation` (after ProcessGames)
  - ✅ Updated `DataController` to include validation step in sequence
  - ✅ Added fixture comparison step after validation (`ProcessFixtureCleanup`)
  - ✅ Added deletion step for invalid and missing fixtures
  - ✅ Added error handling for validation and deletion failures
  - ✅ Updated processing tracker with validation and deletion metrics
  - ⏳ ProcessGames currently commented out for testing (needs to be re-enabled for full flow)
- [x] Created `FixtureValidationProcessor`
  - ✅ Created `FixtureValidationProcessor.js` in `dataProcessing/processors/`
  - ✅ Coordinates validation with existing game processing
  - ✅ Validation happens after data refresh (before comparison)
  - ✅ Passes validation results to comparison service
- [x] Add comprehensive logging
  - ✅ Added log prefix system ([VALIDATION], [CLEANUP], [STAGE], etc.) for easy tracing
  - ✅ Logs 404 errors with full context (fixture ID, URL, team, account)
  - ✅ Logs validation results (valid, invalid, errors, timeouts)
  - ✅ Logs comparison results (fixtures found, missing, invalid, new)
  - ✅ Logs deletion operations (which fixtures deleted, why - 404 or missing)
  - ✅ Added metrics to processing tracker (validated count, invalid count, deleted count)
- [ ] Create unit tests
  - ⏳ Test 404 error handling in fetcher
  - ⏳ Test URL validation logic (404 detection, timeout handling)
  - ⏳ Test fixture comparison logic
  - ⏳ Test deletion functionality
  - ⏳ Test integration in processors
- [ ] Create integration tests
  - ⏳ Test full flow: scrape → validate → compare → delete
  - ✅ Tested with fixtures that return 404 (existing DB fixtures) - WORKING
  - ⏳ Test with fixtures removed from source (not in scraped data) - Needs ProcessGames enabled
  - ⏳ Test with fixtures that have changed URLs
  - ✅ Tested validation batch processing - WORKING
  - ✅ Tested error handling and recovery - WORKING
- [ ] Update documentation
  - ⏳ Update `readMe.md` files in relevant folders
  - ✅ Documented deletion functionality (code comments, NEXT_STEPS.md)
  - ✅ Documented configuration options (code comments)
  - ⏳ Document 404 error handling behavior in readMe files

## Constraints, Risks, Assumptions

### Constraints

- Strapi API must support deletion operations (DELETE method)
- Database schema must support soft delete if implemented (may need `deletedAt` field)
- Configuration must be flexible to enable/disable deletion per account or globally

### Risks

- Accidental deletion of valid fixtures if comparison logic has bugs
- Performance impact of fetching all existing fixtures for comparison
- 404 errors might be temporary (network issues, server downtime) - need to handle gracefully
- Soft delete vs hard delete decision affects data recovery options

### Assumptions

- Fixtures removed from PlayHQ should be removed from our database
- 404 errors on scorecard URLs indicate fixture is no longer available or URL has changed
- Existing fixtures in DB may have stale URLs that return 404
- Validation should be done per account/team scope, not globally
- Comparison should be done after validation to identify both invalid URLs and missing fixtures
- Deletion should be logged and tracked for audit purposes
- Validation should happen as a separate step in the sync process (after scraping, before comparison)

---

# Summaries of Completed Tickets

### TKT-2025-005 – On-Demand Account Update Feature

Successfully implemented on-demand account sync feature with full processing capabilities. Created new `updateAccountOnly` queue in `queueConfig.js`, implemented `UpdateAccountOnlyProcessor` that routes to `Controller_Club`/`Controller_Associations` for full sync processing, created queue handler `updateAccountOnlyQueue.js` with event listeners and CMS notifications, and registered queue in `worker.js`. The feature performs complete sync (competitions, teams, games, data collections) without handoff to another worker. Flow: Admin FE button → Strapi CMS endpoint → Redis Bull queue → Worker processes → CMS notified. All documentation updated including `QUEUE_JOB_PARAMETERS.md` with Strapi implementation guide. Feature tested and working correctly.
