# Folder Overview

This folder contains API modules for data operations including assignment, control, data evaluation, Puppeteer scraping, and utility functions. These modules handle the core business logic for managing sports associations, clubs, competitions, and team data through web scraping, data processing, and API operations.

## Files

- `AssignCenter/`: Modules for assigning competitions, game data, and teams to associations and clubs
- `ControllerCenter/`: Controllers for orchestrating association and club processing operations
- `DataCenter/`: Data evaluation and assessment modules for associations and clubs
- `Puppeteer/`: Web scraping modules organized by entity type (associations, clubs, competitions)
- `ScrapeCenter/`: Core scraping functionality and utilities for competitions, games, and teams
- `Utils/`: Shared utility functions for API communication, logging, and notifications

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Consumed by: Main controller (`controller.js`), worker (`worker.js`), and data processing modules
- Key dependencies: Puppeteer for web scraping, API utilities, data processing modules

## Dependencies

- Internal:
  - `AssignCenter/`: Competition and game data assignment operations
  - `ControllerCenter/`: Association and club management orchestration
  - `DataCenter/`: Data evaluation and quality assessment
  - `Puppeteer/`: Entity-specific web scraping operations
  - `ScrapeCenter/`: Core scraping logic and utilities
  - `Utils/`: Shared utilities (HTTP, logging, notifications)
- External:
  - Puppeteer (browser automation)
  - Puppeteer-extra (enhanced Puppeteer)
  - Node-fetch (HTTP requests)
  - Winston (structured logging)
  - @slack/web-api (Slack notifications)
  - Moment (date handling)
