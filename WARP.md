# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is the **Fixtura Account Sync Service** - a Node.js web worker that synchronizes sports club and association data by scraping PlayHQ websites and storing processed data in a Strapi database. The service uses Redis queues, Puppeteer for web scraping, and has a comprehensive integration testing framework.

## Common Development Commands

### Running the Service
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# Worker only (main entry point)
npm run worker
```

### Testing
```bash
# Run Jest test suite
npm test

# Test database connection and configuration
node test-connection.js
```

### Environment Setup
```bash
# Required .env file variables
NODE_ENV=development
FIXTURA_API=http://127.0.0.1:1337
FIXTURA_TOKEN=your_api_token_here
```

### Monitoring
```bash
# View Heroku logs (if deployed)
npm run LOGS
```

## Architecture Overview

### Core Components
- **worker.js**: Main entry point - initializes queue processors and integration tests
- **controller.js**: Orchestrates the three-phase data sync process (Competitions → Teams → Games)
- **Redis Queues**: Manages three job types:
  - `syncUserAccount`: Main sync operations
  - `onboardNewAccount`: New account setup
  - `checkAssetGeneratorAccountStatus`: Asset status monitoring

### Data Processing Pipeline
The service follows a strict three-phase processing model:

1. **Competition Phase**: Scrape and assign competitions from PlayHQ
2. **Team Phase**: Scrape teams from competition ladders  
3. **Game Phase**: Scrape game data for all teams (processed in batches of 10)

### Directory Structure
- **api/**: Core business logic modules
  - `ScrapeCenter/`: Web scraping operations
  - `AssignCenter/`: Data assignment to database
  - `DataCenter/`: Data evaluation and processing
  - `Utils/`: Shared utilities and API fetchers
- **src/**: Service infrastructure
  - `queues/`: Redis queue management
  - `utils/`: Service utilities (logging, connection health)
  - `config/`: Environment configuration
- **dataProcessing/**: Data transformation and processing modules
- **common/**: Shared base controllers and utilities

### Account Types
The service handles two distinct account types with different processing paths:
- **Club Accounts**: `Controller_Club()` - single club processing
- **Association Accounts**: `Controller_Associations()` - multi-club processing

## Error Handling Strategy

The service implements comprehensive error handling with null-safety checks:

- **Connection Issues**: Graceful degradation when API/PlayHQ is unreachable
- **Scraping Failures**: Continue processing other data when individual scrapes fail
- **Data Validation**: Array and null checks before accessing properties
- **Retry Logic**: Configurable retry attempts with timeout handling
- **Notifications**: Slack alerts for critical failures

### Key Error-Prone Areas
- **GameCrud.js**: Contains null-safety improvements for `checkIfGameExists()` and `getTeamsIds()`
- **Fetcher.js**: Enhanced with connection timeout and ECONNREFUSED handling
- **AssignGameData.js**: Handles null responses and continues processing

## Development Workflow

### Connection Testing
Always run connection tests before development:
```bash
node test-connection.js
```
This validates API connectivity and provides troubleshooting guidance.

### Memory Management
The service monitors memory usage during processing:
- Peak memory usage is tracked for each job
- Browser instances are cleaned up after scraping
- Memory tracking runs every 20 seconds during processing

### Integration Testing Framework ✅
The service includes a complete integration testing suite:
- **Phase 1**: Tests 4 competition scrapers
- **Phase 2**: Tests 20 team scrapers  
- **Phase 3**: Tests 82 game scrapers
- Execution time: ~71.8 seconds
- Results stored in Strapi with comprehensive logging

## Debugging and Troubleshooting

### Common Issues
1. **ECONNREFUSED errors**: API server not running - check FIXTURA_API configuration
2. **Null reference errors**: Improved with null-safety checks in recent updates
3. **Memory issues**: Monitor with built-in memory tracking
4. **Stuck queues**: Check Redis connection and worker process status

### Log Files
- Application logs via Winston
- Memory usage tracking during processing
- Error-specific logging with context information
- Slack notifications for real-time error alerts

### Configuration Validation
The service validates required environment variables on startup and provides clear error messages for missing configuration.

## Performance Considerations

- **Batch Processing**: Games processed in batches of 10 teams to manage memory
- **Browser Management**: Puppeteer instances cleaned up after each operation
- **Queue Processing**: Multiple jobs can run simultaneously
- **Resource Cleanup**: Automated memory and resource management

## Development Notes

- Uses nodemon for development with JSON file watching disabled
- Puppeteer configured with stealth plugin for scraping
- Winston logging with multiple transports (file + console)
- Bull queues with Redis for job management
- Integration with Slack Web API for notifications

The service is designed for high reliability with comprehensive error handling, making it suitable for production environments while maintaining detailed logging for development and debugging.