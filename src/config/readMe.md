# Folder Overview

This folder contains configuration modules for the service including environment settings, queue configuration, Redis connection settings, and proxy configuration. These modules handle all service configuration, environment variable validation, and environment-specific settings.

## Files

- `environment.js`: Environment variable configuration, validation, API config, admin config, and proxy config initialization
- `queueConfig.js`: Bull queue configuration settings and queue setup
- `redisConfig.js`: Redis connection configuration and client setup
- `proxyConfig.js`: Proxy configuration utilities for parsing, validation, and rotation (Decodo proxy support). Host and port range (10001-10100) are configured in code, credentials via environment variables.

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All service modules requiring configuration
- Key dependencies: Environment variables, Redis, Bull queue, proxy services

## Dependencies

- Internal: Used by all service modules
- External:
  - Dotenv (environment variable management)
  - IORedis (Redis client)
  - Bull (job queue)
