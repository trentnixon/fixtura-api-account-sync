# Folder Overview

This folder contains Redis queue management modules for handling job queues, error handling, and queue utilities. These modules manage the Bull-based job queue system used for processing scraping and synchronization tasks.

## Files

- `checkAssetGeneratorAccountStatus.js`: Checks account status for asset generation
- `onboardNewAccount.js`: Handles onboarding of new accounts
- `queueErrorHandler.js`: Error handling for queue operations
- `queueUtils.js`: Utility functions for queue management
- `syncUserAccountQueue.js`: Main queue for user account synchronization

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Bull queue system, Redis, task processing

## Dependencies

- Internal: Task processing modules
- External:
  - Bull (job queue)
  - IORedis (Redis client)
  - Winston (logging)
