# Folder Overview

This folder contains data assignment modules for competitions, games, and teams. These modules handle the assignment and linking of data entities within the sports management system.

## Files

- `assignCompetitions.js`: Assigns competitions to associations and clubs
- `assignGameData.js`: Assigns game data to teams and competitions
- `assignTeamsToComps.js`: Links teams to competitions
- `competition/`: Competition-specific assignment modules
- `games/`: Game data assignment modules
- `teams/`: Team assignment modules

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Competition, game, and team management

## Dependencies

- Internal:
  - `competition/`: Competition assignment logic
  - `games/`: Game data assignment
  - `teams/`: Team assignment logic
- External:
  - Winston (logging)
  - Node-fetch (API calls)
