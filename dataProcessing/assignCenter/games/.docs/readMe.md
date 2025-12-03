# Folder Overview

This folder contains game data assignment modules for managing game-related CRUD operations. These modules handle the assignment and management of game data within competitions and teams.

## Files

- `GameCrud.js`: CRUD operations for game data
  - `checkIfGameExists()`: Checks if a game exists by gameID
  - `createGame()`: Creates a new game
  - `updateGame()`: Updates an existing game
  - `deleteGame()`: Deletes a game (hard delete)
  - `softDeleteGame()`: Marks a game as deleted (soft delete)
  - `getFixturesForTeams()`: Fetches all fixtures for given team IDs
  - `getFixturesForAccount()`: Fetches all fixtures for an account

## Relations

- Parent folder: [../readMe.md](../readMe.md)
- Key dependencies: Game data management

## Dependencies

- Internal: Data processing utilities
- External:
  - Winston (logging)
  - Node-fetch (API calls)
