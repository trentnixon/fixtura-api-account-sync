# Research: Club and Association Direct ID Processing Feature

**Date**: 2025-01-XX
**Status**: Research Phase
**Goal**: Extend application to process club/association IDs directly (without account IDs)

---

## Overview

Currently, the application requires an **account ID** to start/process an account. The proposed feature would allow processing a **club ID** or **association ID** directly, processing as if it was a club/association, but **without account details and sync**.

---

## Current Architecture Analysis

### Current Flow (Account-Based)

1. **Queue receives job** with `getSync: { ID: accountId, PATH: "CLUB" | "ASSOCIATION" }`
2. **Account ID is used** to fetch account details from CMS
3. **Club/Association is extracted** from account:
   - For Clubs: `getClubObj(accountId)` → fetches account → extracts `Account.attributes.clubs.data[0]`
   - For Associations: `getAssociationObj(accountId)` → fetches account → extracts `Account.attributes.associations.data[0]`
4. **Detailed org data fetched** using club/association ID
5. **Processing occurs** with structured data containing:
   ```javascript
   {
     TYPEOBJ: { TYPEID, TYPEURL },
     ACCOUNT: { ACCOUNTID, ACCOUNTTYPE },
     DETAILS: { ...club/association attributes... },
     TEAMS: [...],
     Grades: [...]
   }
   ```
6. **Data collection created** with account ID (`initCreateDataCollection(accountId)`)
7. **Processing stages** use `dataObj.ACCOUNT.ACCOUNTID` throughout

### Key Files and Functions

#### Queue Configuration

- **File**: `src/config/queueConfig.js`
- **Current queues**: `syncUserAccount`, `onboardNewAccount`, `updateAccountOnly`
- **Job data structure**: `{ getSync: { ID: accountId, PATH: "CLUB" | "ASSOCIATION" } }`

#### Data Fetching

- **File**: `dataProcessing/utils/ProcessorUtils.js`
- **Functions**:
  - `getClubObj(ID)` - Takes account ID, fetches account, extracts club
  - `getDetailedClubDetails(CLUBID)` - Takes club ID directly, fetches full club data
  - `getAssociationObj(ID)` - Takes account ID, fetches account, extracts association
  - `getDetailedAssociationDetails(ASSOCIATIONID)` - Takes association ID directly, fetches full association data

#### Data Service

- **File**: `dataProcessing/services/dataService.js`
- **Function**: `fetchData(fromStrapi)` - Routes to club or association fetching
- **Structure returned**: Always includes `ACCOUNT: { ACCOUNTID, ACCOUNTTYPE }`
- **Data collection**: `initCreateDataCollection(accountId)` - Requires account ID

#### Controllers

- **File**: `src/controller/controller.js`
- **Functions**: `Controller_Club`, `Controller_Associations` - Both take account-based data structure
- **File**: `dataProcessing/controllers/dataController.js`
- **Method**: `start()` - Uses `dataObj.ACCOUNT.ACCOUNTID` throughout processing
- **Data collection**: Line 69-70 creates collection with account ID

---

## Research Questions & Findings

### 1. Can we add 2 new Bull queues (1 for club, 1 for association)?

**Answer**: ✅ **YES, technically feasible**

**Implementation Approach**:

- Add to `queueNames` in `src/config/queueConfig.js`:
  ```javascript
  syncClubDirect: "syncClubDirect",
  syncAssociationDirect: "syncAssociationDirect",
  ```
- Queues will receive direct club/association IDs:

  ```javascript
  // For Club
  { getSync: { ID: clubId, PATH: "CLUB" } }

  // For Association
  { getSync: { ID: associationId, PATH: "ASSOCIATION" } }
  ```

**Considerations**:

- ✅ Queue system is extensible and already supports multiple queues
- ✅ Queue initialization is handled automatically via `initializeQueues()`
- ✅ Need to create queue handlers (similar to `updateAccountOnlyQueue.js`)
- ✅ Need to register queues in `worker.js`

**Alternative Approach**:

- Could use a single queue with a flag to indicate direct ID vs account ID
- **Recommendation**: Separate queues for clarity and easier routing

---

### 2. Can we fetch details directly from org and process normally without account sync?

**Answer**: ⚠️ **PARTIALLY YES - requires modifications**

#### What Works Currently:

✅ **Direct club/association fetching already exists**:

- `getDetailedClubDetails(CLUBID)` - Takes club ID directly
- `getDetailedAssociationDetails(ASSOCIATIONID)` - Takes association ID directly
- These functions don't require account ID

✅ **Processing logic is org-based**:

- Competition processing uses club/association competitions
- Team processing uses club/association teams
- Game processing uses teams from org
- All processing works with org data structure

#### What Needs Modification:

❌ **Data structure requires ACCOUNT object**:

- Current structure always includes: `ACCOUNT: { ACCOUNTID, ACCOUNTTYPE }`
- `DataController.start()` uses `dataObj.ACCOUNT.ACCOUNTID` in multiple places:
  - Line 70: Data collection creation
  - Line 78: Logging
  - Line 86: Logging
  - Line 95: Logging
  - Many other logging statements throughout

❌ **Data collection creation requires account ID**:

- `initCreateDataCollection(accountId)` expects account ID
- Data collections are linked to accounts in CMS
- **Question**: Should we skip data collection creation for direct ID processing?

❌ **Account sync operations**:

- Current flow includes account status updates (`isSetup`, `isUpdating`)
- `notifyCMSAccountSync(accountId, status)` requires account ID
- **Question**: Should we skip these notifications for direct ID processing?

#### Required Modifications:

1. **Create new data fetching functions** that work with direct IDs:

   ```javascript
   // New functions needed:
   async fetchDataForClubDirect(clubId) {
     const clubObj = { TYPEID: clubId, TYPEURL: ... };
     const details = await getDetailedClubDetails(clubId);
     return {
       TYPEOBJ: clubObj,
       ACCOUNT: { ACCOUNTID: null, ACCOUNTTYPE: "CLUB" }, // No account ID
       DETAILS: details.attributes,
       TEAMS: ...,
       Grades: ...
     };
   }
   ```

2. **Modify DataController to handle missing account ID**:

   - Skip data collection creation if `ACCOUNT.ACCOUNTID` is null
   - Use club/association ID for logging instead of account ID
   - Skip account status updates if no account ID

3. **Create new controller functions**:

   - `Controller_ClubDirect(fromRedis)` - Skips account operations
   - `Controller_AssociationDirect(fromRedis)` - Skips account operations

4. **Update processing tracker** (if needed):
   - May need to handle null account IDs in tracking
   - Consider using org ID for tracking instead

---

## Data Collection Endpoint Consideration

**User Requirement**: "No data collection endpoint here, but we can keep the process as it is already built in."

**Interpretation**:

- ✅ Keep all processing stages (competitions, teams, games, validation, cleanup)
- ❌ Skip data collection creation (`initCreateDataCollection`)
- ✅ Keep processing logic intact

**Impact**:

- Processing tracker will still work (uses collection ID internally)
- No record of processing in CMS (no data collection entry)
- All scraping and data processing will occur normally
- Results will be saved to CMS (competitions, teams, games)

---

## NEW APPROACH: Pseudo/Sudo Account ID Strategy

**Updated Strategy**: Instead of handling null account IDs throughout the codebase, create a **pseudo/sudo account ID** to satisfy the existing data structure.

### Proposed Flow (Revised)

1. **GET request** → Receives club/association ID from Bull queue
2. **Fetch org data directly** (new process) using club/association ID
3. **Create pseudo/sudo account ID** to satisfy data structure:
   - Option A: Placeholder/null account ID (goes nowhere)
   - Option B: Link to admin/demo account (single parent account for all direct processing)
4. **Complete process** using existing logic without modifications

### Benefits of This Approach

✅ **Minimal code changes** - No need to handle null account IDs throughout codebase
✅ **Reuse existing logic** - All processing stages work as-is
✅ **Satisfy data structure** - ACCOUNT object always has valid ID
✅ **Data collections work** - Can still create collections (if using admin account)
✅ **Logging works** - All logging statements continue to work
✅ **Error handling works** - No special cases for missing account ID

### Implementation Options

#### Option A: Null/Placeholder Account ID

```javascript
{
  TYPEOBJ: { TYPEID: clubId, TYPEURL: ... },
  ACCOUNT: { ACCOUNTID: null, ACCOUNTTYPE: "CLUB" },
  DETAILS: ...,
  TEAMS: ...,
  Grades: ...
}
```

**Pros**:

- Simple to implement
- No CMS dependency for account lookup
- Clear indication it's a placeholder

**Cons**:

- Data collection creation will fail (unless modified)
- Account status updates will fail (unless skipped)
- May cause issues if account ID is required elsewhere

#### Option B: Admin/Demo Account as Parent (RECOMMENDED)

```javascript
{
  TYPEOBJ: { TYPEID: clubId, TYPEURL: ... },
  ACCOUNT: { ACCOUNTID: ADMIN_ACCOUNT_ID, ACCOUNTTYPE: "CLUB" },
  DETAILS: ...,
  TEAMS: ...,
  Grades: ...
}
```

**Pros**:

- ✅ All existing logic works without modification
- ✅ Data collections can be created (linked to admin account)
- ✅ Account operations work (but update admin account, not user account)
- ✅ Easy to identify direct ID processing (all link to same admin account)
- ✅ Centralized management (all direct processing visible in one place)

**Cons**:

- Requires admin account to exist in CMS
- Admin account will have many data collections (if enabled)
- Need to distinguish between admin account's real syncs vs direct ID processing

**Recommendation**: **Option B (Admin/Demo Account)**

### Detailed Implementation Flow (Pseudo Account Approach)

```
1. GET Request
   ↓
2. Bull Queue receives job: { getSync: { ID: clubId/associationId, PATH: "CLUB"/"ASSOCIATION" } }
   ↓
3. Queue Handler → Task Processor → Controller
   ↓
4. NEW: Direct Org Data Fetching
   - fetchClubDirectData(clubId) OR fetchAssociationDirectData(associationId)
   - Fetches org data directly (bypasses account lookup)
   - Gets club/association details using existing getDetailedClubDetails() or getDetailedAssociationDetails()
   ↓
5. NEW: Pseudo Account ID Resolution
   - getPseudoAccountId(orgType)
   - Returns: ADMIN_ACCOUNT_ID (from env) or null
   ↓
6. Structure Data Object
   {
     TYPEOBJ: { TYPEID: clubId/associationId, TYPEURL: ... },
     ACCOUNT: { ACCOUNTID: ADMIN_ACCOUNT_ID, ACCOUNTTYPE: "CLUB"/"ASSOCIATION" },
     DETAILS: ...club/association details...,
     TEAMS: [...],
     Grades: [...]
   }
   ↓
7. EXISTING: DataController.start() - WORKS AS-IS!
   - Uses existing logic without modifications
   - Creates data collection (if enabled) → linked to admin account
   - Processes competitions, teams, games → all work normally
   - All logging works (uses account ID)
   - All error handling works
   ↓
8. EXISTING: Processing Stages - ALL WORK AS-IS!
   - ProcessCompetitions → works normally
   - ProcessTeams → works normally
   - ProcessGames → works normally
   - ProcessFixtureValidation → works normally
   - ProcessFixtureCleanup → works normally
   ↓
9. Optional: Skip Account Operations (if needed)
   - Skip account status updates (isSetup, isUpdating)
   - Skip notifyCMSAccountSync (or use Slack/webhook)
   ↓
10. Complete - All data saved to CMS normally
```

### Key Simplifications

✅ **No modifications needed to**:

- `DataController.start()` method
- `ProcessCompetitions`, `ProcessTeams`, `ProcessGames` methods
- Processing tracker
- Error handling
- Logging (uses account ID from structure)

✅ **Only need to create**:

- New data fetching functions (direct org fetch)
- Pseudo account ID resolver (simple function)
- New queue handlers (similar to existing)
- New task processors (similar to existing)

### Updated Implementation Strategy

#### Phase 1: Queue Setup (Easy) - UNCHANGED

1. Add two new queues to `queueConfig.js`:

   - `syncClubDirect`
   - `syncAssociationDirect`

2. Create queue handlers:

   - `src/queues/syncClubDirectQueue.js`
   - `src/queues/syncAssociationDirectQueue.js`

3. Register queues in `worker.js`

#### Phase 2: New Data Fetching Process (Moderate) - REVISED

1. Create new data fetching functions in `dataProcessing/utils/ProcessorUtils.js`:

   - `fetchClubDirectData(clubId)` - Direct club fetching (bypasses account)
   - `fetchAssociationDirectData(associationId)` - Direct association fetching (bypasses account)

2. Create pseudo account ID resolver:

   ```javascript
   // In DataService or new utility
   async getPseudoAccountId(orgType) {
     // Option A: Return null (if skipping account operations)
     // return null;

     // Option B: Return admin account ID (RECOMMENDED)
     const adminAccountId = process.env.ADMIN_ACCOUNT_ID || 1;
     return adminAccountId;
   }
   ```

3. Modify `DataService` to support direct ID mode:
   - New method: `fetchDataDirect(orgId, orgType)`
   - Fetches org data directly (bypasses account lookup)
   - Creates pseudo account ID and returns structure:
     ```javascript
     {
       TYPEOBJ: { TYPEID: orgId, TYPEURL: ... },
       ACCOUNT: { ACCOUNTID: pseudoAccountId, ACCOUNTTYPE: orgType },
       DETAILS: ...,
       TEAMS: ...,
       Grades: ...
     }
     ```

**Key Difference**: Now we have a valid account ID in the structure, so existing code works!

#### Phase 3: Controller Setup (Easy) - SIMPLIFIED

1. Create new controller functions in `src/controller/controller.js`:

   - `Controller_ClubDirect(fromRedis)` - Uses direct data fetching
   - `Controller_AssociationDirect(fromRedis)` - Uses direct data fetching

2. **No modifications needed to DataController** - It works as-is because account ID exists!

3. Create new task processors:
   - `src/tasks/clubDirectTaskProcessor.js`
   - `src/tasks/associationDirectTaskProcessor.js`

**Major Simplification**: No need to modify `DataController.start()` - it will work with the pseudo account ID!

#### Phase 4: Account Operations Decision (Easy)

**Decision**: What to do with account operations when using pseudo account ID?

**Options**:

1. **Skip all account operations** (recommended for placeholder/null)

   - Skip `initCreateDataCollection`
   - Skip account status updates
   - Skip `notifyCMSAccountSync`

2. **Use admin account operations** (if using admin account)
   - Create data collections (linked to admin account)
   - Update admin account status (if needed)
   - Send notifications (but for admin account)

**Recommendation**: If using admin account (Option B), we can keep all operations but they'll be linked to admin account. This provides full tracking capability.

### Environment Configuration

Add to `.env` or configuration:

```javascript
// Admin account ID for direct club/association processing
ADMIN_ACCOUNT_ID = 1; // Or whatever the demo/admin account ID is
```

### Data Collection Considerations

**If using admin account approach**:

- All data collections for direct ID processing will be linked to admin account
- Easy to query all direct ID processing: `data-collections?account.id=ADMIN_ACCOUNT_ID`
- Consider adding a flag/marker to distinguish direct ID collections from real admin account syncs

**If using null approach**:

- Skip data collection creation entirely
- No tracking in CMS (as per requirement)

### Account Status Updates

**If using admin account**:

- Account status updates will affect admin account (not ideal, but harmless)
- Consider skipping these or adding a flag to prevent updates

**If using null**:

- Skip account status updates (as per requirement)

### Notification Considerations

**Options**:

1. Skip notifications entirely
2. Use Slack/webhook with org ID instead of account ID
3. Send notifications for admin account (if using admin account)

**Recommendation**: Use Slack/webhook with org ID - provides visibility without affecting admin account

---

## Implementation Strategy

### Phase 1: Queue Setup (Easy)

1. Add two new queues to `queueConfig.js`:

   - `syncClubDirect`
   - `syncAssociationDirect`

2. Create queue handlers:

   - `src/queues/syncClubDirectQueue.js`
   - `src/queues/syncAssociationDirectQueue.js`

3. Register queues in `worker.js`

**Estimated Complexity**: Low
**Dependencies**: None

---

### Phase 2: Data Fetching (Moderate)

1. Create new data fetching functions in `dataProcessing/utils/ProcessorUtils.js`:

   - `fetchClubDirectData(clubId)` - Direct club fetching
   - `fetchAssociationDirectData(associationId)` - Direct association fetching

2. Modify `DataService` to support direct ID mode:
   - New method: `fetchDataDirect(orgId, orgType)`
   - Returns structure with `ACCOUNT.ACCOUNTID = null`

**Estimated Complexity**: Medium
**Dependencies**: Understanding of current data structure requirements

---

### Phase 3: Controller Modifications (Moderate-Hard)

1. Create new controller functions in `src/controller/controller.js`:

   - `Controller_ClubDirect(fromRedis)`
   - `Controller_AssociationDirect(fromRedis)`

2. Modify `DataController` to handle null account IDs:

   - Conditional data collection creation
   - Conditional account status updates
   - Use org ID for logging when account ID is null

3. Create new task processors:
   - `src/tasks/clubDirectTaskProcessor.js`
   - `src/tasks/associationDirectTaskProcessor.js`

**Estimated Complexity**: High
**Dependencies**: Phase 2 completion

---

### Phase 4: Testing & Validation (Complex)

1. Test with real club/association IDs
2. Verify no account operations occur
3. Verify all processing stages complete
4. Verify data is saved correctly

**Estimated Complexity**: High
**Dependencies**: Phase 3 completion

---

## Key Decisions Needed

### Decision 1: Data Collection Creation

**Question**: Should we skip data collection creation entirely, or create a different type of collection?

- **Option A**: Skip entirely (no tracking in CMS)
- **Option B**: Create org-based collections (requires schema changes)
- **Option C**: Use a placeholder/null account ID

**Recommendation**: Option A (skip entirely) - aligns with "no data collection endpoint"

---

### Decision 2: Account Status Updates

**Question**: Should we skip account status updates (`isSetup`, `isUpdating`) when processing direct IDs?

- **Option A**: Skip all account operations
- **Option B**: Attempt to find account linked to org and update it
- **Option C**: Update org status fields (if they exist)

**Recommendation**: Option A (skip all account operations) - aligns with "without account details and sync"

---

### Decision 3: Job Data Structure

**Question**: How should we structure the job data for direct ID queues?

- **Option A**: Same structure, but ID represents org ID instead of account ID
  ```javascript
  { getSync: { ID: clubId, PATH: "CLUB" } }
  ```
- **Option B**: New structure with explicit flag
  ```javascript
  { getSync: { ID: clubId, PATH: "CLUB", DIRECT: true } }
  ```
- **Option C**: Separate field for org ID
  ```javascript
  { getSync: { CLUBID: clubId, PATH: "CLUB" } }
  ```

**Recommendation**: Option A (same structure) - simpler, reuses existing validation

---

### Decision 4: Error Handling

**Question**: What happens if club/association ID is invalid or not found?

- **Option A**: Fail job with error
- **Option B**: Skip gracefully
- **Option C**: Notify via different mechanism (Slack?)

**Recommendation**: Option A (fail job) - matches current behavior

---

### Decision 5: Notification Mechanism

**Question**: How should we notify completion/failure without account ID?

- **Option A**: Skip notifications entirely
- **Option B**: Use Slack/webhook notifications with org ID
- **Option C**: Create org-based notification system

**Recommendation**: Option B (Slack/webhook) - provides visibility without account dependency

---

## Files That Will Need Modification

### Core Files

1. `src/config/queueConfig.js` - Add new queues
2. `src/queues/` - Create new queue handlers (2 files)
3. `worker.js` - Register new queues
4. `src/controller/controller.js` - Add new controller functions
5. `dataProcessing/controllers/dataController.js` - Handle null account IDs
6. `dataProcessing/services/dataService.js` - Add direct ID fetching methods
7. `dataProcessing/utils/ProcessorUtils.js` - Add direct ID utilities
8. `src/tasks/` - Create new task processors (2 files)

### Documentation Files

9. `QUEUE_JOB_PARAMETERS.md` - Document new queue parameters
10. `DevelopmentRoadMap.md` - Track feature progress
11. `Tickets.md` - Create ticket for this feature
12. `readMe.md` files - Update relevant folder documentation

---

## Technical Challenges

### Challenge 1: Account ID Dependency in Logging

**Issue**: Many log statements use `dataObj.ACCOUNT.ACCOUNTID`
**Solution**: Create helper function to get identifier:

```javascript
getEntityIdentifier(dataObj) {
  return dataObj.ACCOUNT.ACCOUNTID || dataObj.TYPEOBJ.TYPEID;
}
```

### Challenge 2: Processing Tracker

**Issue**: Processing tracker may expect account ID
**Solution**: Modify tracker to use org ID when account ID is null

### Challenge 3: Error Context

**Issue**: Errors may reference account ID
**Solution**: Update error logging to use org ID when account ID unavailable

### Challenge 4: Testing Without Account Link

**Issue**: Hard to verify org belongs to valid account
**Solution**: Validate org exists in CMS before processing

---

## Recommendations

### Immediate Actions

1. ✅ **Research phase complete** - Understanding of current architecture
2. ⏳ **Decide on key decisions** - Review Decision points above
3. ⏳ **Create detailed implementation plan** - Based on decisions
4. ⏳ **Update Tickets.md** - Create ticket with phases

### Best Practices

1. **Maintain backward compatibility** - Don't break existing account-based flows
2. **Clear separation** - Keep direct ID processing separate from account-based
3. **Comprehensive logging** - Log org ID prominently in direct ID flows
4. **Error handling** - Handle missing account gracefully throughout
5. **Testing** - Test with various org IDs (valid, invalid, orphaned)

### Future Considerations

1. **Could we fetch account from org?** - If org has account relationship, auto-fetch
2. **Bulk processing** - Process multiple orgs at once
3. **Scheduling** - Schedule direct org processing separately from account sync
4. **Metrics** - Track direct ID processing separately from account sync

---

---

## Approach Comparison

### Original Approach: Null Account ID Handling

**Complexity**: Medium-High

- Requires modifications throughout codebase to handle null account IDs
- Need conditional logic in DataController
- Need to skip account operations conditionally
- Need helper functions for identifier resolution

**Risk**: Medium

- Risk of missing null checks
- Risk of breaking existing logic
- Risk of incomplete error handling

**Code Changes**: Extensive

- Modify `DataController.start()` to handle null IDs
- Add conditional checks throughout
- Update all logging to use helper function
- Modify data collection creation
- Skip account operations

---

### NEW Approach: Pseudo/Sudo Account ID (RECOMMENDED)

**Complexity**: Low-Medium

- Minimal code changes required
- Reuse existing logic without modification
- Only need new data fetching functions
- No conditional logic needed in DataController

**Risk**: Low

- Low risk of breaking existing flows
- All existing error handling works
- All existing logging works
- Clear separation via queue

**Code Changes**: Minimal

- Add new data fetching functions (direct org fetch)
- Create pseudo account ID resolver
- Add new queues and handlers
- Reuse existing DataController as-is

**Benefits**:

- ✅ Much simpler implementation
- ✅ Faster development time
- ✅ Lower risk of bugs
- ✅ Easier to test
- ✅ Easier to maintain

---

## Conclusion

**Feasibility**: ✅ **HIGHLY FEASIBLE** with minimal modifications (using pseudo account approach)

**Key Findings**:

1. ✅ Bull queues can be added easily
2. ✅ Direct org data fetching already exists
3. ✅ **NEW**: Pseudo account ID approach eliminates need for null handling
4. ✅ **NEW**: Existing DataController works without modifications
5. ✅ **NEW**: All processing logic can be reused as-is

**Complexity Estimate**: **LOW-MEDIUM** (with pseudo account approach)

- Queue setup: Low complexity
- Data fetching: Low-Medium complexity (new direct fetch functions)
- Controller modifications: **MINIMAL** (reuse existing controllers!)
- Testing: Low-Medium complexity

**Risk Level**: **LOW** (with pseudo account approach)

- Very low risk of breaking existing account-based flows (no changes to existing code)
- Low risk of bugs (reusing proven code paths)
- Low risk of data inconsistency (clear separation via queues)

**Recommendation**: **Use pseudo/sudo account ID approach (Option B: Admin Account)**

**Benefits**:

- Minimal code changes required
- Faster implementation
- Lower risk
- Easier to maintain
- Full tracking capability (if using admin account)
- Easy to identify direct ID processing (all link to admin account)

**Next Steps**:

1. ✅ Review and decide on key decision points

   - **Decision**: Use admin/demo account as pseudo account ID (Option B)
   - **Decision**: Skip account status updates for direct ID processing
   - **Decision**: Use Slack/webhook for notifications (not admin account)
   - **Decision**: Create data collections (linked to admin account) OR skip entirely

2. ✅ Create detailed ticket in `Tickets.md` (with updated approach)
3. ⏳ Plan implementation phases (simplified phases)
4. ⏳ Begin Phase 1 implementation (queue setup)

---

## Additional Notes

- The existing `getDetailedClubDetails()` and `getDetailedAssociationDetails()` functions already support direct ID fetching - this is a good foundation
- Processing logic is largely org-agnostic once data is structured - minimal changes needed there
- Main challenge is handling the missing account ID gracefully throughout the codebase
- Consider creating a "Direct ID Processing Mode" flag that can be checked throughout the codebase
