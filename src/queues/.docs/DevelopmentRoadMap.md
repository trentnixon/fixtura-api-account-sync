# Development Roadmap – Queues

This file tracks **progress, priorities, and recommendations** for the queues module. It should remain **clean and high-level**, while detailed planning lives in `Tickets.md`.

---

## ✅ Completed

- [x] Implemented queue state management for exclusive resource access
- [x] Added browser cleanup after job completion across all queues
- [x] Standardized error handling with queueErrorHandler
- [x] Implemented CMS/webhook notifications for all queues
- [x] Added extended timeout settings for direct sync queues (2-hour max)
- [x] Implemented queue recovery mechanisms for stuck pause states
- [x] Added job data validation before processing
- [x] Removed commented-out code in `checkAssetGeneratorAccountStatus.js` (TKT-2025-003)
- [x] Standardized error handler usage across all queues (TKT-2025-004)
- [x] Implemented queue monitoring and metrics with health checks and Slack alerts (TKT-2025-005)
- [x] Refactored common queue processing patterns into `baseQueueHandler.js` (57% code reduction, TKT-2025-006)
- [x] Added Slack notifications for job start events

---

## ⏳ To Do (easy → hard)

1. [ ] Add comprehensive queue testing

   - Unit tests for queue utilities
   - Integration tests for queue processors
   - Test queue state manager recovery scenarios
   - Test concurrent queue handling
   - (see TKT-2025-XXX for details)

2. [ ] Implement queue priority system

   - Add priority levels for different job types
   - Ensure critical jobs (onboarding) process before regular syncs
   - Consider priority-based queue ordering
   - (see TKT-2025-XXX for details)

3. [ ] Add job deduplication improvements
   - Enhance `isJobInQueue` to check by account ID across all queues
   - Prevent duplicate jobs for same account in different queues
   - Add job cancellation for superseded jobs
   - (see TKT-2025-XXX for details)

---

## 💡 Recommendations

- **Testing**: Add comprehensive test coverage for queue processors, especially edge cases like stuck jobs, concurrent processing attempts, and recovery scenarios. Unit tests for queue utilities and integration tests for queue processors.

- **Performance**: Consider optimizing browser cleanup - currently closes browser after every job. Could batch jobs or reuse browser instances with proper isolation.

- **Queue Configuration**: Review timeout and retry settings. Direct sync queues have 2-hour timeouts which may need adjustment based on actual processing times and monitoring data.

- **Job Deduplication**: Enhance `isJobInQueue` to check by account ID across all queues. Prevent duplicate jobs for same account in different queues and add job cancellation for superseded jobs.

- **Queue Priority**: Implement priority system to ensure critical jobs (onboarding) process before regular syncs. Consider priority-based queue ordering.

- **Monitoring Enhancements**: Consider adding custom metrics dashboards, historical trend analysis, and predictive alerting based on processing patterns.

---

### Example Usage

- Mark off items as they are completed.
- Reorder tasks so easier jobs always appear first.
- Update when scope changes or new requirements arise.
- Cross-reference each task with its ticket for detailed breakdowns and discussions.
