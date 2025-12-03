# Folder Overview

Manages Redis/Bull queue processors for account synchronization, onboarding, and direct organization processing.

## Files

**Queue Handlers (Refactored to use baseQueueHandler):**

- `checkAssetGeneratorAccountStatus.js`: Processes asset bundle creation jobs. Routes to ClubTaskProcessor or AssociationTaskProcessor based on PATH. Handles `startAssetBundleCreation` queue with CMS account notifications.
- `onboardNewAccount.js`: Handles new account onboarding for CLUB and ASSOCIATION paths. Sends completion email notifications. Processes `onboardNewAccount` queue with browser cleanup.
- `syncUserAccountQueue.js`: Synchronizes user accounts from cron jobs. Supports CLUB and ASSOCIATION paths. Processes `syncUserAccount` queue with browser cleanup, CMS notifications, and test data support.
- `syncClubDirectQueue.js`: Direct club processing bypassing account lookup. Uses ClubDirectTaskProcessor. Processes `syncClubDirect` queue with extended timeout (2 hours), direct org notifications, and custom stalled job handling.
- `syncAssociationDirectQueue.js`: Direct association processing bypassing account lookup. Uses AssociationDirectTaskProcessor. Processes `syncAssociationDirect` queue with extended timeout (2 hours), direct org notifications, and custom stalled job handling.
- `updateAccountOnlyQueue.js`: On-demand account updates performing full sync (competitions, teams, games) without worker handoff. Uses UpdateAccountOnlyProcessor. Processes `updateAccountOnly` queue with browser cleanup, CMS notifications, and test data support.

**Base Infrastructure:**

- `baseQueueHandler.js`: **Core queue handler utility** that provides common queue processing patterns. All queue handlers use this module to reduce code duplication and ensure consistency. Supports pause/resume, browser cleanup, notifications (CMS account, direct org, email), event listeners (failed, completed, stalled), test data handling, and custom hooks.

**Utilities:**

- `queueErrorHandler.js`: Centralized error handler factory for queue error events. Logs critical errors with job context.
- `queueUtils.js`: Utility functions for queue operations: `isJobInQueue`, `addJobToQueue`, `getQueueStats`, `processWithErrorHandler`.

**Monitoring:**

- `queueMetrics.js`: Metrics collection and tracking module. Tracks queue depth, processing times, success/failure rates, and provides aggregated metrics across all queues.
- `queueHealthCheck.js`: Health check module for queues. Checks Redis connectivity, queue pause states, stuck jobs, and validates queue state manager consistency. Returns health status (healthy, degraded, unhealthy).
- `queueMonitoringService.js`: Monitoring service that orchestrates periodic metrics collection, health checks, and alerting. Provides external access to metrics and health status, logs periodic summaries, and sends Slack alerts for backlogs, processing rate drops, failure rates, and health degradation. Includes alert throttling to prevent spam. Automatically started in `worker.js` and gracefully shut down on process termination.

## Relations

- Parent folder: [../../readMe.md](../../readMe.md)
- Key dependencies: `tasks` module (task processors), `utils/queueStateManager`, `utils/cmsNotifier`, `config/queueConfig`
- Consumed by: `worker.js` (initializes all queue handlers)

## Dependencies

- Internal: `tasks` (ClubTaskProcessor, AssociationTaskProcessor, ClubDirectTaskProcessor, AssociationDirectTaskProcessor, UpdateAccountOnlyProcessor), `utils/queueStateManager`, `utils/cmsNotifier`, `utils/logger`, `utils/fetcher`, `dataProcessing/puppeteer/PuppeteerManager`
- External: Bull queue system, Redis

## Queue Processing Patterns

All queues use `baseQueueHandler.js` which provides consistent patterns:

- **Concurrency:** Set to 1 (exclusive processing) by default
- **Queue Management:** Pause all other queues on job start, resume on completion/failure (via queueStateManager)
- **Resource Cleanup:** Optional browser cleanup after job completion (configurable per queue)
- **Notifications:** Support for CMS account sync, direct org processing (Slack), and email notifications (configurable per queue)
- **Event Listeners:** Failed, completed, and stalled event handlers (configurable per queue)
- **Error Handling:** Centralized error handling with queue error handler integration
- **Test Data Support:** Optional test data parameter for direct processing (bypasses queue)
- **Custom Hooks:** `onJobStart`, `onJobComplete`, `onJobError`, `onFailed` hooks for queue-specific logic

**Queue-Specific Configurations:**

- `checkAssetGeneratorAccountStatus`: CMS account notifications, failed handler
- `syncUserAccount`: Browser cleanup, CMS account notifications, failed/completed handlers, test data support
- `onboardNewAccount`: Browser cleanup, email notifications
- `updateAccountOnly`: Browser cleanup, CMS account notifications, failed/completed handlers, test data support
- `syncClubDirect`: Browser cleanup, direct org notifications (CLUB), failed/completed/stalled handlers, test data support, custom stalled handling
- `syncAssociationDirect`: Browser cleanup, direct org notifications (ASSOCIATION), failed/completed/stalled handlers, test data support, custom stalled handling

**Benefits of baseQueueHandler:**

- **57% code reduction** across all queue files (1,071 → 465 lines)
- **Consistent patterns** automatically applied to all queues
- **Easier maintenance** - common changes made in one place
- **Better error handling** - standardized error recovery and logging
- **Faster development** - new queues can use base handler instead of copying code
