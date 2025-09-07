# Folder Overview

This folder contains shared utility functions and API fetchers used across the application. These modules provide common functionality for HTTP requests, logging, and data fetching operations.

## Files

- `APIfetcher.js`: API fetching utility functions
- `fetcher.js`: HTTP request utility functions
- `fetcherv2.js`: Enhanced HTTP request utilities
- `logger.js`: Logging utility functions
- `SlackTransport.js`: Slack notification transport

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Winston logging, Slack API

## Dependencies

- Internal: Shared across all API modules
- External:
  - Node-fetch (HTTP requests)
  - Winston (logging)
  - Slack Web API (notifications)
