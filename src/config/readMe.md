# Folder Overview

This folder contains configuration modules for the service including environment settings, queue configuration, and Redis connection settings. These modules handle all service configuration and environment-specific settings.

## Files

- `environment.js`: Environment variable configuration and validation
- `queueConfig.js`: Bull queue configuration settings
- `redisConfig.js`: Redis connection configuration

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Environment variables, Redis, Bull queue

## Dependencies

- Internal: Used by all service modules
- External:
  - Dotenv (environment variables)
  - IORedis (Redis client)
  - Bull (job queue)
