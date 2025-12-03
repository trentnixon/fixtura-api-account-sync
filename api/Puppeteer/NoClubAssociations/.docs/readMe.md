# Folder Overview

This folder contains modules for handling associations that don't have traditional clubs, including international teams and specialized competition structures. These modules handle unique scraping scenarios for non-standard association types.

## Files

- `assignIntTeams.js`: Assigns international teams to associations
- `assignTeamGameData.js`: Assigns game data to teams
- `DELETE_ScrapeUtils.js`: Deprecated scraping utilities (marked for deletion)
- `getAssociationLadder.js`: Scrapes ladder data for associations
- `getFixutreResults.js`: Scrapes fixture and results data
- `getTeams.js`: Scrapes team data
- `getTeamsGameData.js`: Scrapes game data for teams
- `NoClubsInAssociationDetails.js`: Main controller for no-club associations

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Puppeteer, specialized association handling

## Dependencies

- Internal: Specialized association and team management
- External:
  - Puppeteer (browser automation)
  - Winston (logging)
