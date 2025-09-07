# Folder Overview

This folder contains core scraping functionality and utilities for extracting sports data from web sources. These modules provide the fundamental scraping capabilities used throughout the application.

## Files

- `getCompetitions.js`: Scrapes competition data from web sources
- `getGameData.js`: Scrapes game and fixture data
- `getTeamsFromLadder.js`: Extracts team data from ladder/standings pages
- `UTILS/`: Utility modules for scraping operations

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, scraping utilities

## Dependencies

- Internal:
  - `UTILS/`: Scraping utility functions and constants
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
  - Node-fetch (HTTP requests)
