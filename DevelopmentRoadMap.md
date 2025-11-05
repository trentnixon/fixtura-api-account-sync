# Development Roadmap – On-Demand Account Update Feature

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
