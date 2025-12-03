# Folder Overview

This folder contains configuration modules for the service including environment settings, queue configuration, Redis connection settings, and proxy configuration. These modules handle all service configuration, environment variable validation, and environment-specific settings.

## Files

- `environment.js`: Environment variable configuration, validation, API config, admin config, proxy config, and parallel processing config initialization
- `queueConfig.js`: Bull queue configuration settings and queue setup
- `redisConfig.js`: Redis connection configuration and client setup
- `proxyConfig.js`: Proxy configuration utilities for parsing, validation, and rotation (Decodo proxy support). Host and port range (10001-10100) are configured in code, credentials via environment variables.

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All service modules requiring configuration
- Key dependencies: Environment variables, Redis, Bull queue, proxy services

## Configuration Options

### Parallel Processing Configuration

The following environment variables control parallel processing performance:

- `PARALLEL_PAGE_POOL_SIZE`: Number of pages to create in the page pool (default: 3)
- `PARALLEL_COMPETITIONS_CONCURRENCY`: Number of concurrent associations to process (default: 3)
- `PARALLEL_TEAMS_CONCURRENCY`: Number of concurrent teams to process (default: 3)
- `PARALLEL_VALIDATION_CONCURRENCY`: Number of concurrent fixture validations (default: 5)

These settings help optimize processing time when using proxies by allowing multiple pages to work in parallel, reducing the impact of proxy authentication overhead (3-4 seconds per page).

## Dependencies

- Internal: Used by all service modules
- External:
  - Dotenv (environment variable management)
  - IORedis (Redis client)
  - Bull (job queue)
