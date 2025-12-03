# Folder Overview

This folder contains core scraping functionality for data processing including competitions, game data, and ladder/team extraction. These modules provide the fundamental scraping capabilities used in the data processing pipeline.

## Files

- `Competitions/`: Competition scraping modules
- `GameData/`: Game data scraping modules
- `Ladder/`: Ladder and team extraction modules

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, scraping utilities

## Dependencies

- Internal:
  - `Competitions/`: Competition scraping logic
  - `GameData/`: Game data scraping
  - `Ladder/`: Team extraction from ladders
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
