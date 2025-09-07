# Folder Overview

This folder contains modules for scraping club details including team information, competitions, and game data. These modules handle comprehensive club data extraction and management using Puppeteer automation.

## Files

- `assignTeamGameData.js`: Assigns game data to teams
- `assignTeamtoClub.js`: Links teams to clubs
- `ClubDetailsController.js`: Main controller for club details operations
- `GetClubDetails.js`: Scrapes club detail information
- `getClubTeams.js`: Scrapes team data for clubs
- `getCompetitions.js`: Scrapes competition data for clubs
- `getTeamsGameData.js`: Scrapes game data for teams

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, club management

## Dependencies

- Internal: Club and team management modules
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
