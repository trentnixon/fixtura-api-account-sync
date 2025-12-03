# Development Roadmap – ScrapeAccountSync Service

This file tracks **progress, priorities, and recommendations** for the ScrapeAccountSync service. It should remain **clean and high-level**, while detailed planning lives in `Tickets.md`.

---

## ✅ Completed

- [x] On-demand account update feature (full sync without worker handoff)
- [x] Direct organization ID processing (club/association direct processing)
- [x] Multi-stage data processing pipeline (competitions, teams, games, validation, cleanup)
- [x] Fixture validation and cleanup system (404 detection, comparison, deletion)
- [x] Processing tracking and monitoring system
- [x] Memory optimization with browser restart between stages
- [x] Integration testing framework
- [x] Queue-based job processing system
- [x] Error handling and recovery mechanisms

---

## ⏳ To Do (easy → hard)

1. [ ] **Service Enhancements**

   - Add service health monitoring and status endpoints
   - Implement graceful shutdown handling
   - Add service performance metrics and analytics
   - (see TKT-2025-XXX for details)

2. [ ] **Testing Improvements**

   - Expand integration test coverage
   - Add unit tests for all modules
   - Implement end-to-end testing scenarios
   - (see TKT-2025-XXX for details)

3. [x] **Performance Optimization** ⚡ COMPLETED
   - **Proxy Performance Optimization** - Implemented parallel processing architecture
   - [x] Implement parallel page processing (multiple tabs concurrently)
   - [x] Optimize proxy authentication and connection pooling (via page reuse)
   - [x] Reduce navigation overhead and resource blocking
   - [x] Fix race conditions in page pooling mechanism
   - [x] Implement dynamic pool sizing based on concurrency limits
   - (see `PERFORMANCE_OPTIMIZATION.md` for detailed strategies and implementation plan)

4. [ ] **Code Quality**

   - Consolidate duplicate functionality across modules
   - Remove deprecated code (e.g., DELETE_ScrapeUtils.js)
   - Standardize error handling patterns
   - (see TKT-2025-XXX for details)

5. [ ] **Architecture Improvements**
   - Refactor to use shared data processing modules consistently
   - Implement dependency injection
   - Add module health monitoring
   - (see TKT-2025-XXX for details)

---

## 💡 Recommendations

- Consider implementing a service registry for better organization
- Add comprehensive monitoring and alerting for all service components
- Implement service configuration management system
- Add support for service scaling and load balancing
- Consider implementing a service health dashboard
- Add comprehensive API documentation for all service operations
- Implement service audit logging and history
- Consider adding support for distributed processing
- Add service dependency management and health checks
- Consider implementing a service plugin system for extensibility

---

## Feature Details

### 1. [On-Demand Account Update Feature](#on-demand-account-update-feature) ✅ COMPLETE

### 2. [Direct Organization ID Processing Feature](#direct-organization-id-processing-feature) ✅ COMPLETE

### 3. [Fixture Deletion and 404 Error Handling](#fixture-deletion-and-404-error-handling) ⏳ IN PROGRESS

---

# On-Demand Account Update Feature

This feature adds a new queue option that allows triggering full account syncs on-demand. It performs the complete sync (competitions, teams, games, data collections) but does not hand off to another worker—it completes and notifies the CMS when done.

---

## ✅ Completed

- [x] Roadmap created and feature scoped
- [x] **Create new queue configuration** – Added `updateAccountOnly` queue to `queueConfig.js`
  - Added queue name to `queueNames` object
  - Queue auto-initializes via `initializeQueues()` function
- [x] **Create account update processor** – Created `updateAccountOnlyProcessor.js` in `src/tasks/`
  - Extends `TaskProcessor` base class
  - Implements `process()` method that routes to `Controller_Club` or `Controller_Associations`
  - Performs full sync: competitions, teams, games, data collections
  - Does NOT hand off to another worker
  - Updates CMS with completion status via `notifyCMSAccountSync`
- [x] **Create queue handler** – Created `updateAccountOnlyQueue.js` in `src/queues/`
  - Similar structure to `syncUserAccountQueue.js`
  - Processes jobs from `updateAccountOnly` queue
  - Uses `UpdateAccountOnlyProcessor` (works for both Club and Association)
  - Handles success/failure events
  - Notifies CMS on completion/failure (backup notifications)
- [x] **Register queue in worker** – Updated `worker.js`
  - Imported new queue handler (`handleUpdateAccountOnly`)
  - Initialized queue processing in `initializeQueueProcessing()`
  - Added error handling for queue initialization

---

## ⏳ To Do (easy → hard)

5. [x] **Create API endpoint/trigger mechanism** – Implemented via Strapi CMS

   - ✅ Option C selected: Admin FE button → Strapi CMS endpoint → Redis Bull queue
   - ✅ Strapi endpoint created: `/api/account/update-account-only`
   - ✅ Queue job parameters documented in `QUEUE_JOB_PARAMETERS.md`

6. [x] **Define account update scope** – Clarified and implemented

   - ✅ Full sync implemented: competitions, teams, games, data collections
   - ✅ Uses existing `Controller_Club` and `Controller_Associations` methods
   - ✅ Calls `DataController.start()` for complete processing
   - ✅ No handoff to another worker confirmed

7. [x] **Add error handling and logging** – Implemented

   - ✅ Error logging added throughout processor and queue handler
   - ✅ Edge cases handled (missing account ID, invalid account type)
   - ✅ CMS notifications work on both success and failure
   - ✅ Queue error handler integrated

8. [x] **Testing** – Completed initial testing
   - ✅ Tested with club accounts (account 429)
   - ✅ Verified CMS notifications sent correctly
   - ✅ Verified full sync processing works
   - ✅ Confirmed no handoff to another worker
   - ⏳ Additional testing with association accounts recommended

---

## 💡 Recommendations

- **Consider reusability**: If the account update logic is already in `DataController`, consider adding a flag or parameter to `start()` method to skip competitions/teams/games processing, rather than duplicating code.

- **Queue naming**: Use a clear, descriptive name like `updateAccountOnly` or `updateAccountDetails` to distinguish it from the full sync.

- **CMS integration**: Coordinate with CMS team to determine the best approach for triggering on-demand updates (API endpoint, direct queue access, or webhook).

- **Documentation**: Update `readMe.md` files in relevant folders to document the new queue and its purpose.

- **Future enhancements**: Consider adding job status tracking so users can see when an on-demand update is in progress or completed.

---

## 📋 Questions to Resolve

~~1. **What exactly is "account update"?**~~ ✅ Resolved

- Full sync implemented: competitions, teams, games, data collections

~~2. **Should this use existing controller methods or new ones?**~~ ✅ Resolved

- Using existing `Controller_Club` and `Controller_Associations` methods
- Calls `DataController.start()` for complete processing

~~3. **Where should the trigger button/endpoint live?**~~ ✅ Resolved

- Implemented via Strapi CMS endpoint
- Admin FE button → Strapi → Redis Bull queue

---

# Fixture Deletion and 404 Error Handling

This feature implements comprehensive handling for missing fixtures (404 errors) and automatic deletion of fixtures that no longer exist on the source website.

---

## ✅ Completed

- [x] Roadmap created and feature scoped

---

## ⏳ To Do (easy → hard)

### 1. 404 Error Handling in Fetcher and Scrapers (Easy)

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

### 2. Existing Fixture Validation (Moderate) - ✅ COMPLETED

- [x] Add method to fetch existing fixtures from database in `GameCRUD.js`
  - ✅ Created `getFixturesForTeams()` method with batching and date filtering
  - ⏳ `getFixturesForCompetition()` - Not implemented (not needed)
  - ⏳ `getFixturesForAccount()` - Not implemented (Strapi limitations)
- [x] Create fixture URL validation service
  - ✅ Created `FixtureValidationService.js` in `dataProcessing/services/`
  - ✅ Implemented Puppeteer-based validation for accurate 404 detection
  - ✅ Handles timeouts and network errors gracefully
  - ✅ Returns validation result (valid, 404, error, timeout, http_403)
- [x] Create batch URL validation processor
  - ✅ Implemented `validateFixturesBatch()` with sequential processing
  - ✅ Tracks validation results (valid, invalid, errors)
  - ✅ Logs validation progress and results
- [x] Create `FixtureValidationProcessor.js` in `dataProcessing/processors/`
  - ✅ Fetches existing fixtures from database
  - ✅ Validates all existing fixture URLs (test for 404s)
  - ✅ Marks fixtures as invalid if URLs return 404
  - ✅ Stores validation results for use in comparison phase
- [x] Add new processing stage in `DataController.start()`
  - ✅ Added `ProcessFixtureValidation` stage after data refresh
  - ✅ Integrated validation into account sync sequence

### 3. Comparison Logic for Missing Fixtures (Moderate) - ✅ COMPLETED

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

### 4. Deletion Functionality (Hard) - ✅ COMPLETED

- [x] Add deletion method to `GameCRUD.js`
  - ✅ Created `deleteGame()` method that deletes fixture by ID (hard delete)
  - ✅ Created `softDeleteGame()` method that marks fixture as deleted (soft delete)
  - ✅ Supports hard delete and soft delete
  - ✅ Handles deletion errors gracefully
  - ✅ Logs deletion operations with fixture details
- [x] Create fixture deletion service
  - ✅ Created `FixtureDeletionService.js` in `dataProcessing/services/`
  - ✅ Implemented batch deletion functionality (batches of 10)
  - ✅ Added configuration for hard vs soft delete
  - ✅ Tracks deleted fixtures in processing tracker
- [x] Add deletion configuration
  - ✅ Added config option to enable/disable automatic deletion (`deletionEnabled`)
  - ✅ Added config for hard vs soft delete preference (`deleteMode`)
  - ✅ Added config for deletion batch size (`batchSize: 10`)
  - ✅ Configuration documented in code comments
  - ✅ Currently enabled with soft delete mode

### 5. Integration and Testing (Complex) - ⏳ PARTIALLY COMPLETED

- [x] Integrate validation and deletion into `DataController.start()`
  - ✅ Added new processing stage: `ProcessFixtureValidation` (after data refresh)
  - ✅ Updated `DataController` to include validation step in sequence
  - ✅ Added fixture comparison step after validation (`ProcessFixtureCleanup`)
  - ✅ Added deletion step for invalid and missing fixtures
  - ✅ Added error handling for validation and deletion failures
  - ✅ Updated processing tracker with validation and deletion metrics
  - ⏳ ProcessGames currently commented out (needs re-enabling for full flow)
- [x] Add comprehensive logging
  - ✅ Added log prefix system ([VALIDATION], [CLEANUP], [STAGE], etc.)
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
  - ⏳ Test full flow: scrape → validate → compare → delete (needs ProcessGames enabled)
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

---

## 💡 Recommendations

- **Validation as Separate Step**: Make fixture validation a distinct step in the sync process. This allows us to identify stale URLs before comparison, making the deletion logic more accurate.

- **Soft Delete First**: Start with soft delete implementation to allow data recovery if needed. Hard delete can be added later as an option.

- **Configuration Flags**: Add feature flags to enable/disable validation and deletion per account or globally, allowing gradual rollout and easy rollback.

- **404 Retry Logic**: Consider implementing retry logic for 404 errors, as they might be temporary (network issues, server downtime). Only delete after multiple consecutive 404s across multiple syncs.

- **Batch Validation**: Process fixture URL validation in batches with concurrency limits to avoid overwhelming the source website and manage memory usage.

- **Audit Trail**: Maintain detailed logs of all validation and deletion operations for audit purposes and data recovery if needed.

- **Performance Optimization**: For large datasets, consider batching validation, comparison, and deletion operations to avoid memory issues and API rate limits.

- **Testing Strategy**: Test extensively with real-world scenarios, including fixtures that are temporarily unavailable vs permanently removed, and fixtures with changed URLs.

---

## 📋 Questions to Resolve

1. **Soft Delete vs Hard Delete?**

   - Should we implement soft delete (mark as deleted) or hard delete (actual removal)?
   - Does Strapi schema support soft delete fields (deletedAt, isDeleted)?
   - Recommendation: Start with soft delete for safety

2. **404 Retry Strategy?**

   - How many 404 attempts before considering fixture deleted?
   - Should we retry 404s on next sync or mark immediately?
   - Recommendation: Mark after 2-3 consecutive 404s

3. **Deletion Scope?**

   - Should deletion be per-team, per-competition, or per-account?
   - Should we validate all fixtures or only recent ones?
   - Recommendation: Per-team scope for validation and deletion accuracy

4. **Validation Timing?**

   - Should validation happen during every sync or on a schedule?
   - Should we validate all fixtures or only ones that haven't been validated recently?
   - Recommendation: Validate during every sync, but consider caching validation results

5. **Configuration Management?**
   - Should deletion be enabled by default or opt-in?
   - Should it be configurable per account or globally?
   - Recommendation: Opt-in with per-account configuration

---

# Direct Organization ID Processing Feature

This feature allows processing club or association data directly using their organization IDs, without requiring an associated user account. It bypasses the account lookup step and uses a pseudo/sudo admin account ID internally to satisfy data structure requirements.

**Status**: ✅ **COMPLETE**

---

## ✅ Completed

- [x] Research and planning completed (TKT-2025-001)
  - Analyzed existing architecture
  - Identified key decisions (pseudo account ID strategy)
  - Created detailed implementation plan
- [x] **Phase 1: Queue Setup** - Added two new Bull queues
  - Added `syncClubDirect` queue to `queueConfig.js`
  - Added `syncAssociationDirect` queue to `queueConfig.js`
  - Registered queues in `worker.js`
  - Created queue handlers (`syncClubDirectQueue.js`, `syncAssociationDirectQueue.js`)
- [x] **Phase 2: Data Fetching** - New direct data fetching methods
  - Created `fetchClubDirectData(clubId)` in `ProcessorUtils.js`
  - Created `fetchAssociationDirectData(associationId)` in `ProcessorUtils.js`
  - Added `getPseudoAccountId(orgType)` utility function
  - Added `ADMIN_ACCOUNT_ID` to environment config
  - Added `fetchDataDirect(orgId, orgType)` method to `DataService`
  - Added `reSyncDataDirect(orgId, orgType)` method to `DataController`
  - All Phase 2 tests passed with real IDs (27958, 3292)
- [x] **Phase 3: Controller Setup** - Controllers and task processors
  - Created `Controller_ClubDirect(fromRedis)` in `controller.js`
  - Created `Controller_AssociationDirect(fromRedis)` in `controller.js`
  - Created `ClubDirectTaskProcessor` in `src/tasks/`
  - Created `AssociationDirectTaskProcessor` in `src/tasks/`
  - Updated queue handlers to use new processors
  - All processing stages work as-is (no modifications needed)
- [x] **Phase 4: Account Operations & Notifications** - Skip account updates, implement notifications
  - Task processors skip account status updates (no `isSetup`, no `isUpdating`)
  - Created `notifyDirectOrgProcessing(orgId, orgType, status, errorMessage)` function
  - Sends Slack/webhook notifications (not CMS account endpoints)
  - Improved error handling with prominent org ID logging
  - All notifications integrated into queue handlers
- [x] **Phase 5: Testing & Validation** - End-to-end testing
  - Created comprehensive test script (`testPhase5DirectProcessing.js`)
  - Association test (3292) passed successfully (all stages completed)
  - Error handling tests created and improved
  - Club test (27958) configured and ready
- [x] **Phase 6: Documentation** - Complete documentation
  - Created `QUEUE_JOB_PARAMETERS_DIRECT_IDS.md` with full queue documentation
  - Updated `QUEUE_JOB_PARAMETERS.md` to reference direct ID queues
  - Updated `DevelopmentRoadMap.md` with feature progress
  - Updated `src/queues/readMe.md` with new queue files
  - Updated `src/tasks/readMe.md` with new task processors
  - Updated `src/controller/readMe.md` with new controller functions

---

## Key Features

- ✅ Processes organizations directly by ID (no account lookup needed)
- ✅ Full processing pipeline (competitions, teams, games, validation, cleanup)
- ✅ Uses pseudo admin account ID internally (configured via `ADMIN_ACCOUNT_ID` env var)
- ✅ Skips account status updates (`isSetup`, `isUpdating` not modified)
- ✅ Notifications sent via Slack/webhook (not CMS account endpoints)
- ✅ All existing processing stages work as-is (no modifications needed)
- ✅ Comprehensive error handling with prominent org ID logging

---

## Queue Names

- `syncClubDirect`: Direct club ID processing
- `syncAssociationDirect`: Direct association ID processing

---

## Environment Configuration

Required environment variable:

```bash
ADMIN_ACCOUNT_ID=436  # Pseudo/sudo admin account ID used internally
```

Optional Slack configuration:

```bash
SlackToken=xoxb-your-slack-token
SLACK_DIRECT_ORG_CHANNEL=#data-account
SLACK_DIRECT_ORG_ERROR_CHANNEL=#data-account-error
```

---

## Documentation

- Queue job parameters: [`QUEUE_JOB_PARAMETERS_DIRECT_IDS.md`](./QUEUE_JOB_PARAMETERS_DIRECT_IDS.md)
- Implementation details: [`Tickets.md`](./Tickets.md)
- Research findings: [`RESEARCH_CLUB_ASSOCIATION_IDS.md`](./RESEARCH_CLUB_ASSOCIATION_IDS.md)

---

## Testing

Test scripts available:

- Phase 2: [`__tests__/testPhase2DirectDataFetching.js`](./__tests__/testPhase2DirectDataFetching.js)
- Phase 5: [`__tests__/testPhase5DirectProcessing.js`](./__tests__/testPhase5DirectProcessing.js)

Test IDs:

- Club ID: `27958`
- Association ID: `3292`
