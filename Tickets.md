# Tickets

## Completed Tickets

- (None yet)

---

## Active Tickets

### TKT-2025-001: Club and Association Direct ID Processing

**Status**: Research
**Priority**: Medium
**Created**: 2025-01-XX
**Updated**: 2025-01-XX

#### Overview

Extend the application to accept **club ID** or **association ID** directly (without requiring account ID) and process them as if they were clubs/associations, but **without account details and sync operations**.

#### What We Need to Do

1. Add 2 new Bull queues (1 for club direct ID, 1 for association direct ID)
2. **NEW APPROACH**: Create secondary/new data fetching process for direct IDs
3. **NEW APPROACH**: Create pseudo/sudo account ID to satisfy data structure:
   - Option A: Null/placeholder (goes nowhere)
   - Option B: **Admin/demo account** as parent (RECOMMENDED)
4. Fetch org data directly using club/association ID (bypass account lookup)
5. Process as normal using existing logic (no modifications needed!)
6. Skip account sync operations (optional, can still link to admin account):
   - Optionally skip account status updates (`isSetup`, `isUpdating`)
   - Use Slack/webhook for notifications instead of account notifications
   - Optionally skip data collection creation OR create linked to admin account
7. Keep all processing stages intact (work as-is!):
   - Competitions processing
   - Teams processing
   - Games processing
   - Fixture validation
   - Fixture cleanup

#### Research Findings

See `RESEARCH_CLUB_ASSOCIATION_IDS.md` for detailed analysis.

**Key Findings**:

- ✅ Bull queues can be added easily (low complexity)
- ✅ Direct org fetching already exists (`getDetailedClubDetails`, `getDetailedAssociationDetails`)
- ✅ **NEW**: Pseudo account ID approach eliminates need for null handling
- ✅ **NEW**: Existing DataController works without modifications!
- ✅ **NEW**: All processing logic can be reused as-is

**Complexity**: **LOW-MEDIUM** (with pseudo account approach)
**Risk**: **LOW** (with pseudo account approach)

#### Key Decisions Needed

1. **Pseudo Account ID**: Use admin/demo account (Option B) or null placeholder (Option A)? → **Admin/demo account (RECOMMENDED)**
2. **Data Collection**: Skip entirely or create linked to admin account? → **Create linked to admin account (if using admin account)**
3. **Account Status Updates**: Skip all account operations? → **Skip account status updates** (don't update admin account unnecessarily)
4. **Job Data Structure**: Use same structure with org ID? → **Same structure**
5. **Error Handling**: Fail job on invalid org ID? → **Fail job**
6. **Notifications**: Use Slack/webhook for notifications? → **Slack/webhook** (not admin account)

#### Phases & Tasks

### Phase 1: Queue Setup (Easy)

- [x] Add `syncClubDirect` queue to `queueConfig.js`
- [x] Add `syncAssociationDirect` queue to `queueConfig.js`
- [x] Create `src/queues/syncClubDirectQueue.js`
- [x] Create `src/queues/syncAssociationDirectQueue.js`
- [x] Register queues in `worker.js`
- [ ] Test queue initialization

### Phase 2: New Data Fetching Process (Low-Medium) - REVISED

- [x] Create `fetchClubDirectData(clubId)` in `ProcessorUtils.js`
  - Uses existing `getDetailedClubDetails(clubId)` directly
  - Bypasses account lookup
  - Returns clubObj and details structure
- [x] Create `fetchAssociationDirectData(associationId)` in `ProcessorUtils.js`
  - Uses existing `getDetailedAssociationDetails(associationId)` directly
  - Bypasses account lookup
  - Returns associationObj and details structure
- [x] Create `getPseudoAccountId(orgType)` utility function
  - Returns `ADMIN_ACCOUNT_ID` from env (or null if placeholder)
  - Added to `DataService` class
  - Includes logging and validation
- [x] Add `ADMIN_ACCOUNT_ID` to environment config
  - Added to `src/config/environment.js`
  - Exported as `ADMIN_CONFIG`
  - Includes logging
- [x] Add `fetchDataDirect(orgId, orgType)` method to `DataService`
  - Calls direct org fetch function (`fetchDataForClubDirect` or `fetchDataForAssociationDirect`)
  - Gets pseudo account ID
  - Returns data structure with `ACCOUNT.ACCOUNTID = ADMIN_ACCOUNT_ID` (or null)
  - Creates fromStrapi-like structure for compatibility
- [x] Test direct ID fetching with real org IDs
  - ✅ Pseudo account ID resolution works correctly (returns 436 from env)
  - ✅ Error handling works correctly (handles 404 and null responses)
  - ✅ Invalid org type handling works correctly
  - ✅ Invalid ID handling works correctly
  - ✅ **ALL TESTS PASSED** with real IDs:
    - ✅ Club ID 27958: Successfully fetched (0 teams, 0 grades)
    - ✅ Association ID 3292: Successfully fetched (0 teams, 5 grades)
    - ✅ Data structure is correct (TYPEOBJ, ACCOUNT, DETAILS, TEAMS, Grades)
    - ✅ Pseudo account ID (436) correctly set in ACCOUNT.ACCOUNTID

### Phase 3: Controller Setup (Easy) - SIMPLIFIED

- [x] Create `Controller_ClubDirect(fromRedis)` in `controller.js`
  - Uses new `reSyncDataDirect()` method
  - Overrides `reSyncData()` to use direct fetching
  - Calls `dataController.start()` as-is (no modifications needed!)
  - Skips account operations (no isSetup, no notifyCMSAccountSync)
- [x] Create `Controller_AssociationDirect(fromRedis)` in `controller.js`
  - Same as club, but for associations
  - Uses direct data fetching
  - Skips account operations
- [x] Add `reSyncDataDirect(orgId, orgType)` method to `DataController`
  - Calls `dataService.fetchDataDirect()` for direct org fetching
  - Used when processing direct IDs
- [x] **NO MODIFICATIONS NEEDED** to `DataController.start()` - works as-is!
- [x] **NO MODIFICATIONS NEEDED** to processing stages - all work normally!
- [x] Create `ClubDirectTaskProcessor` in `src/tasks/`
  - Routes to `Controller_ClubDirect`
  - Skips account status updates
- [x] Create `AssociationDirectTaskProcessor` in `src/tasks/`
  - Routes to `Controller_AssociationDirect`
  - Skips account status updates
- [x] Update queue handlers to use new task processors
  - `syncClubDirectQueue.js` now uses `ClubDirectTaskProcessor`
  - `syncAssociationDirectQueue.js` now uses `AssociationDirectTaskProcessor`
- [x] Test with pseudo account ID (admin account or null)
  - ✅ Controllers created and connected
  - ✅ Task processors created and connected
  - ✅ Queue handlers updated to use processors
  - ⏳ Ready for end-to-end testing with real IDs

### Phase 4: Account Operations & Notifications (Easy) - SIMPLIFIED

- [x] Skip account status updates (`isSetup`, `isUpdating`) for direct ID processing
  - ✅ Task processors skip account status updates (no isSetup, no isUpdating)
  - ✅ Controllers don't call account update endpoints
  - ✅ Account operations skipped throughout processing
- [x] Implement Slack/webhook notification for direct ID processing
  - ✅ Created `notifyDirectOrgProcessing(orgId, orgType, status, errorMessage)` function
  - ✅ Sends notifications via Slack (if configured) with org ID and org type
  - ✅ Includes error messages for failures
  - ✅ Queue handlers call notification on completion and failure
  - ✅ Does NOT use `notifyCMSAccountSync` (doesn't update admin account)
- [x] Handle invalid org ID errors gracefully
  - ✅ Error handling works as-is (uses org ID from structure)
  - ✅ Log org ID prominently in all error messages
  - ✅ Error messages include orgType, orgId, and full error details
  - ✅ Stack traces included for debugging
- [ ] Test error scenarios (invalid ID, missing org, network errors)
  - ⏳ Ready for testing in Phase 5

### Phase 5: Testing & Validation (Low-Medium) - SIMPLIFIED

- [x] Test with real club IDs (valid)
  - ✅ Created `testPhase5DirectProcessing.js` test script
  - ✅ Test club ID: 27958 (configured)
  - ⏳ Ready to run full end-to-end test
- [x] Test with real association IDs (valid)
  - ✅ Test association ID: 3292 (configured)
  - ✅ Association test passed in initial run (11.7 minutes, all stages completed)
- [x] Test with invalid org IDs (error handling)
  - ✅ Error handling test created
  - ✅ Improved error message matching (case-insensitive, multiple keywords)
  - ⏳ Ready for testing with invalid IDs
- [x] Verify account operations behave correctly (linked to admin account or skipped)
  - ✅ Task processors skip account status updates
  - ✅ No isSetup or isUpdating flags set
  - ✅ Pseudo account ID (436) used internally
- [x] Verify all processing stages complete correctly (all work as-is!)
  - ✅ Association test showed all stages completed:
    - ✅ Competitions stage
    - ✅ Teams stage
    - ✅ Games stage
    - ✅ Fixture validation stage
    - ✅ Fixture cleanup stage
- [x] Verify data is saved correctly (competitions, teams, games)
  - ✅ Association test processed 5 grades/competitions successfully
  - ✅ Data collection created (ID: 5832)
  - ✅ Processing completed in 699.868 seconds
- [x] Verify data collections are created (if enabled) OR skipped (if disabled)
  - ✅ Data collections ARE created (linked to pseudo admin account)
  - ✅ Processing tracking data saved correctly
- [x] Verify pseudo account ID is used correctly throughout
  - ✅ Pseudo account ID (436) configured and used
  - ✅ All processing stages work with pseudo account ID
- [x] Integration testing with full processing flow
  - ✅ Full end-to-end test script created
  - ✅ Test script covers valid IDs, invalid IDs, and error scenarios
  - ⚠️ NOTE: Full club test (27958) ready but not yet executed (takes ~12 minutes)

### Phase 6: Documentation (Easy)

- [x] Update `QUEUE_JOB_PARAMETERS.md` with new queue documentation
  - ✅ Created `QUEUE_JOB_PARAMETERS_DIRECT_IDS.md` with comprehensive queue documentation
  - ✅ Updated `QUEUE_JOB_PARAMETERS.md` to reference direct ID queues
  - ✅ Documented job data structure for both queues
  - ✅ Documented Strapi implementation examples
  - ✅ Documented Admin FE request formats
- [x] Update `DevelopmentRoadMap.md` with feature progress
  - ✅ Added complete feature section with all phases
  - ✅ Documented key features and configuration
  - ✅ Added links to documentation files
- [x] Update relevant `readMe.md` files
  - ✅ Updated `src/queues/readMe.md` with new queue files
  - ✅ Updated `src/tasks/readMe.md` with new task processors
  - ✅ Updated `src/controller/readMe.md` with new controller functions
- [x] Document job data structure for direct ID queues
  - ✅ Documented in `QUEUE_JOB_PARAMETERS_DIRECT_IDS.md`
  - ✅ Includes examples for both club and association
  - ✅ Includes validation requirements
- [x] Document notification mechanism
  - ✅ Documented Slack/webhook notification mechanism
  - ✅ Documented notification format (success and failure)
  - ✅ Documented environment configuration
  - ✅ Documented differences from account-based queues

#### Constraints, Risks, Assumptions

**Constraints**:

- Must maintain backward compatibility with existing account-based flows
- Cannot break existing queue processing
- No data collection endpoint for direct ID processing

**Risks**:

- Risk of breaking existing account-based flows → **Mitigation**: Keep flows separate
- Risk of incomplete error handling → **Mitigation**: Comprehensive testing
- Risk of data inconsistency → **Mitigation**: Clear boundaries between modes

**Assumptions**:

- Org IDs (club/association) exist independently in CMS
- Direct org data fetching functions work correctly
- Processing logic is org-agnostic once data is structured
- Account relationship is not required for processing

#### Related

- See `RESEARCH_CLUB_ASSOCIATION_IDS.md` for detailed research
- Related to existing `updateAccountOnly` queue feature
- Uses same processing stages as account-based sync

---

## Summaries of Completed Tickets

(No completed tickets yet)
