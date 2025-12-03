# Folder Overview

This folder contains service utility functions including connection health checks, HTTP fetchers, logging utilities, and Slack transport. These modules provide common functionality used across the service.

## Files

- `connectionHealthCheck.js`: Health check utilities for service connections
- `fetcher.js`: HTTP request utility functions
- `logger.js`: Logging utility functions
- `SlackTransport.js`: Slack notification transport

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Winston logging, Slack API

## Dependencies

- Internal: Used by all service modules
- External:
  - Node-fetch (HTTP requests)
  - Winston (logging)
  - Slack Web API (notifications)
