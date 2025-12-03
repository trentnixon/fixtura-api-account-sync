# Folder Overview

This folder contains data processing controllers that manage the overall data processing workflow. These controllers orchestrate data processing operations and coordinate between different processing modules.

## Files

- `dataController.js`: Main data processing controller
  - `start()`: Full processing pipeline (competitions, teams, games, fixture validation, fixture cleanup)
  - `updateAccountOnly()`: On-demand account update only (fetches data, no processing)
  - `ProcessCompetitions()`: Processes and assigns competitions
  - `ProcessTeams()`: Processes and assigns teams
  - `ProcessGames()`: Processes and assigns games/fixtures
  - `ProcessFixtureValidation()`: Validates existing database fixtures for URL validity (404 detection)
  - `ProcessFixtureCleanup()`: Compares scraped vs database fixtures and deletes invalid/missing fixtures
  - `ProcessTracking()`: Updates processing tracking data

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Data processing modules, services

## Dependencies

- Internal: Data processing services and utilities
- External:
  - Winston (logging)
