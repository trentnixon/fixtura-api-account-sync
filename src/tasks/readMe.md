# Folder Overview

This folder contains task processing modules that handle the execution of specific tasks from the job queue. These modules process different types of tasks including association and club synchronization operations.

## Files

- `associationTaskProcessor.js`: Processes association-related tasks
- `clubTaskProcessor.js`: Processes club-related tasks
- `taskProcessor.js`: Base task processor with common functionality
- `updateAccountOnlyProcessor.js`: Processes on-demand account updates (full sync without worker handoff)

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Queue system, API modules

## Dependencies

- Internal: API modules, queue management
- External:
  - Winston (logging)
  - Bull (job queue)
