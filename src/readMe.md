# Folder Overview

This folder contains the core service modules including configuration, controllers, queues, tasks, and utilities. These modules form the backbone of the worker service, handling queue management, task processing, and service configuration.

## Files

- `config/`: Service configuration modules
- `controller/`: Main service controller
- `queues/`: Redis queue management modules
- `tasks/`: Task processing modules
- `utils/`: Service utility functions

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Redis, Bull queue system, Winston logging

## Dependencies

- Internal:
  - `config/`: Service configuration
  - `controller/`: Main service controller
  - `queues/`: Queue management
  - `tasks/`: Task processing
  - `utils/`: Service utilities
- External:
  - Bull (Redis-based job queue)
  - IORedis (Redis client)
  - Winston (logging)
  - Node-cron (scheduled tasks)
