# Folder Overview

This folder contains shared utility functions for API communication, logging, and notifications used across the application. These modules provide standardized HTTP request handling, structured logging, and Slack integration for error notifications.

## Files

- `fetcher.js`: Primary HTTP request utility with retry logic, Bearer token authentication, and error handling
- `APIfetcher.js`: Alternative API fetcher implementation (legacy)
- `fetcherv2.js`: Enhanced HTTP request utility (alternative implementation)
- `logger.js`: Winston-based logging utility with custom log levels (critical, error, warn, info, verbose, debug, silly), JSON formatting, and console transport
- `SlackTransport.js`: Winston transport for sending error and warning logs to Slack channels

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: All API modules, data processing modules, and controllers throughout the application
- Key dependencies: Fixtura API, Winston logging, Slack Web API

## Dependencies

- Internal:
  - Used by all modules requiring API communication or logging
- External:
  - Node-fetch (HTTP requests)
  - Winston (structured logging)
  - @slack/web-api (Slack notifications)
  - Dotenv (environment variable management)
