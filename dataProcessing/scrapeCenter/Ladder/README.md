# Ladder Scraping System

## Overview

The Ladder folder contains a comprehensive system for scraping team data from PlayHQ competition ladder pages. This system is designed to be robust, maintainable, and provide detailed monitoring and debugging capabilities.

## Folder Structure

```
dataProcessing/scrapeCenter/Ladder/
├── README.md                    # This documentation
├── getTeamsFromLadder.js       # Main orchestrator for team scraping
├── TeamFetcher.js              # Core team data extraction logic
├── LadderDetector.js           # Detects ladder availability and waits for tables
├── TeamExtractor.js            # Extracts team information from ladder pages
├── PageAnalyzer.js             # Analyzes page structure and provides debugging info
├── PageStructureMonitor.js     # Monitors for website structure changes
├── backoffConfig.js            # Smart backoff strategy configuration
└── Ladder_example.html         # Example HTML structure for reference
```

## How It Works

### **Standard PlayHQ Ladder Structure**

The system is built around the **standard PlayHQ ladder structure** that we discovered:

```html
<div data-testid="ladder" class="sc-1upu7c-6 jvpOtV">
  <div class="sc-1upu7c-4 jQnfTX">
    <table class="sc-1upu7c-2 blNTli">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <a href="/teams/...">Team Name</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- Second table contains statistics -->
</div>
```

**Key Points:**

- **Teams are always in the FIRST table** within `[data-testid="ladder"]`
- **Team links are in the SECOND column** (`td:nth-child(2)`)
- **Second table contains statistics** (not team data)
- **This structure is consistent** across all PlayHQ competitions

### **1. Main Flow** (`getTeamsFromLadder.js`)

- **Entry Point**: Orchestrates the entire team scraping process
- **Competition Processing**: Handles multiple competitions in sequence
- **Error Handling**: Manages failures gracefully and continues processing
- **Progress Tracking**: Logs progress through competitions

### 2. **Team Fetching** (`TeamFetcher.js`)

- **Page Navigation**: Handles Puppeteer page interactions
- **Module Coordination**: Orchestrates specialized modules
- **Club Integration**: Adds club information to team data
- **Performance Monitoring**: Tracks backoff strategy performance

### 3. **Ladder Detection** (`LadderDetector.js`)

- **No Ladder Detection**: Identifies competitions without ladders
- **Smart Backoff**: Uses adaptive waiting strategy for table loading
- **Performance Tracking**: Monitors attempt counts and success rates
- **Table Validation**: Ensures tables contain meaningful data

### 4. **Team Extraction** (`TeamExtractor.js`)

- **Standard Selector**: Uses the reliable PlayHQ ladder structure
- **Link Discovery**: Finds team links using `[data-testid="ladder"] table:first-of-type tbody tr td:nth-child(2) a`
- **Data Extraction**: Extracts team names, IDs, and URLs
- **Data Validation**: Ensures extracted data is complete

#### **Standard Team Selector**

The system uses a **single, reliable selector** that works across all PlayHQ competitions:

```css
[data-testid="ladder"] table:first-of-type tbody tr td:nth-child(2) a
```

**How it works:**

1. **`[data-testid="ladder"]`** - Find the ladder container
2. **`table:first-of-type`** - Get the first table (teams table)
3. **`tbody tr`** - Get all table rows
4. **`td:nth-child(2)`** - Get the second column (team names)
5. **`a`** - Get the team link

**Why this works:**

- **Consistent Structure**: PlayHQ always puts teams in the first table
- **Reliable Positioning**: Team names are always in the second column
- **Clear Hierarchy**: The structure is predictable across all competitions
- **No Fallbacks Needed**: Single selector handles all cases

### 5. **Page Analysis** (`PageAnalyzer.js`)

- **Comprehensive Analysis**: Examines page structure, links, and content
- **Debugging Information**: Provides detailed logs for troubleshooting
- **Structure Validation**: Checks for expected page elements
- **Content Verification**: Validates ladder-related content

### 6. **Structure Monitoring** (`PageStructureMonitor.js`)

- **Change Detection**: Monitors for PlayHQ website updates
- **Baseline Tracking**: Establishes and compares page structures
- **Alert System**: Notifies when investigation is needed
- **Health Assessment**: Provides structure health metrics

### 7. **Backoff Configuration** (`backoffConfig.js`)

- **Strategy Management**: Configurable waiting strategies
- **Performance Metrics**: Tracks attempt counts and success rates
- **Environment Configuration**: Supports different deployment scenarios
- **Customization**: Allows fine-tuning of timing parameters

## Smart Backoff System

### **How It Works**

1. **Quick Initial Check**: Starts with minimal delay (200ms-1s)
2. **Progressive Backoff**: Increases delay only when needed
3. **Smart Termination**: Stops immediately when table found
4. **Performance Tracking**: Monitors success rates and timing

### **Configuration Strategies**

| Strategy         | Initial Delay | Max Delay | Use Case                 |
| ---------------- | ------------- | --------- | ------------------------ |
| **Aggressive**   | 200ms         | 3s        | Speed-critical scenarios |
| **Fast**         | 500ms         | 5s        | High-speed scraping      |
| **Balanced**     | 1s            | 10s       | General use (default)    |
| **Conservative** | 2s            | 15s       | Maximum reliability      |

### **Environment Configuration**

```bash
# Set strategy via environment variable
export SCRAPER_BACKOFF_STRATEGY=fast

# Available strategies: aggressive, fast, balanced, conservative
```

## Page Structure Monitoring

### **What It Monitors**

- **Critical Selectors**: Essential elements for team extraction
- **Alternative Selectors**: Backup strategies for finding content
- **Page Metadata**: Table counts, link counts, content presence
- **Element Attributes**: Class names, IDs, data attributes

### **Change Detection**

- **Baseline Establishment**: Records structure on first run
- **Continuous Monitoring**: Compares current vs. baseline
- **Alert System**: Notifies when investigation needed
- **Health Assessment**: Provides structure health metrics

### **Alert Types**

- **🔴 HIGH PRIORITY**: Critical elements missing/disappeared
- **🟡 MEDIUM PRIORITY**: Element count changes
- **🟢 LOW PRIORITY**: Page metadata changes

## Usage Examples

### **Basic Team Scraping**

```javascript
const TeamFetcher = require("./TeamFetcher");

const teamFetcher = new TeamFetcher(page, teamInfo);
const teams = await teamFetcher.getTeamNamesAndUrls();
```

### **Performance Monitoring**

```javascript
// View performance statistics
teamFetcher.logPerformanceStats();

// Reset metrics for new session
teamFetcher.resetPerformanceMetrics();
```

### **Structure Health Check**

```javascript
const health = await teamFetcher.structureMonitor.getStructureHealth();
console.log(`Structure health: ${health.overall}`);
```

## Troubleshooting

### **Common Issues and Solutions**

#### **1. "No teams found" Error**

**Symptoms:**

- Log shows "No teams found"
- Page loads but no team data extracted
- Table appears to be empty

**Possible Causes:**

- Page structure changed (PlayHQ update)
- Dynamic content not fully loaded
- Selectors no longer valid
- Competition has no ladder

**Solutions:**

```bash
# Check page structure monitoring
export SCRAPER_BACKOFF_STRATEGY=conservative

# Enable detailed logging
# Check logs for structure change alerts
```

#### **2. Slow Performance**

**Symptoms:**

- Each page takes 10+ seconds
- Backoff strategy not working
- Excessive waiting times

**Solutions:**

```bash
# Use more aggressive strategy
export SCRAPER_BACKOFF_STRATEGY=aggressive

# Check performance metrics
# Verify network conditions
```

#### **3. Missing Content**

**Symptoms:**

- Some teams not extracted
- Incomplete data
- Partial ladder information

**Solutions:**

```bash
# Use more conservative strategy
export SCRAPER_BACKOFF_STRATEGY=conservative

# Increase max attempts in backoffConfig.js
# Check for structure changes
```

#### **4. Structure Change Alerts**

**Symptoms:**

- "PAGE STRUCTURE CHANGES DETECTED" alerts
- Selectors failing
- Unexpected behavior

**Investigation Steps:**

1. **Check PlayHQ Website**: Verify if they've updated their site
2. **Examine Alerts**: Review detailed change logs
3. **Update Selectors**: Modify selectors in relevant modules
4. **Test Thoroughly**: Verify with multiple competitions
5. **Update Baseline**: Reset structure monitoring after fixes

### **Debugging Tools**

#### **Page Analysis**

```javascript
// Get comprehensive page information
const analysis = await pageAnalyzer.analyzePage();
pageAnalyzer.logAnalysis(analysis);
```

#### **Structure Monitoring**

```javascript
// Check for structure changes
const changes = await structureMonitor.detectStructureChanges();
if (changes.hasChanges) {
  console.log("Structure changes detected:", changes);
}
```

#### **Performance Metrics**

```javascript
// View backoff strategy performance
const stats = ladderDetector.getPerformanceStats();
console.log("Performance stats:", stats);
```

### **Log Analysis**

#### **Key Log Patterns**

**Successful Scraping:**

```
✅ Ladder table found on attempt 1!
Successfully extracted 3 teams
```

**Structure Changes:**

```
🚨 PAGE STRUCTURE CHANGES DETECTED - INVESTIGATION REQUIRED 🚨
🔴 HIGH PRIORITY CHANGES (IMMEDIATE ACTION REQUIRED):
```

**Performance Issues:**

```
❌ Table not found after 5 attempts
Could not find ladder table after all attempts
```

#### **Log Levels**

- **INFO**: Normal operation, successful operations
- **WARN**: Non-critical issues, fallback strategies
- **ERROR**: Critical issues requiring investigation
- **DEBUG**: Detailed debugging information

### **Configuration Tuning**

#### **Backoff Strategy Tuning**

```javascript
// In backoffConfig.js
const customStrategy = {
  initialDelay: 300, // Start with 300ms
  maxDelay: 8000, // Max 8 seconds
  backoffMultiplier: 1.4, // Increase by 40%
  maxAttempts: 4, // Try 4 times
  quickCheckDelay: 150, // Very quick initial check
};
```

#### **Selector Updates**

```javascript
// In PageStructureMonitor.js
this.criticalSelectors = {
  ladderContainer: '[data-testid="ladder"]',
  // Add new selectors here
  newElement: ".new-selector-class",
};
```

## Maintenance and Updates

### **Regular Tasks**

1. **Monitor Performance**: Check performance metrics weekly
2. **Review Alerts**: Investigate structure change alerts promptly
3. **Update Selectors**: Modify selectors when PlayHQ changes
4. **Test Strategies**: Experiment with different backoff strategies
5. **Document Changes**: Update this README when making changes

### **When PlayHQ Updates**

1. **Immediate Response**: Check structure change alerts
2. **Investigation**: Examine what changed on their website
3. **Selector Updates**: Modify selectors in relevant modules
4. **Testing**: Verify with multiple competitions
5. **Baseline Reset**: Update structure monitoring baseline
6. **Documentation**: Update troubleshooting guides

### **Performance Optimization**

1. **Strategy Selection**: Choose appropriate backoff strategy
2. **Selector Efficiency**: Use most specific selectors possible
3. **Error Handling**: Minimize retry attempts for known issues
4. **Monitoring**: Track success rates and adjust accordingly

## Best Practices

### **Development**

1. **Modular Design**: Keep modules focused on single responsibilities
2. **Error Handling**: Wrap all Puppeteer calls in try-catch blocks
3. **Logging**: Provide detailed logging for debugging
4. **Configuration**: Use external configuration files
5. **Testing**: Test with various competition types

### **Deployment**

1. **Environment Variables**: Use environment-based configuration
2. **Monitoring**: Enable structure change monitoring
3. **Performance Tracking**: Monitor backoff strategy performance
4. **Alerting**: Set up alerts for structure changes
5. **Documentation**: Keep troubleshooting guides updated

### **Troubleshooting**

1. **Start Simple**: Begin with basic page analysis
2. **Check Logs**: Review detailed logging output
3. **Verify Structure**: Confirm page structure hasn't changed
4. **Test Selectors**: Validate selectors manually
5. **Adjust Strategy**: Modify backoff strategy as needed
6. **Document Solutions**: Record solutions for future reference

## Support and Resources

### **Key Files for Common Issues**

- **Selector Problems**: `PageStructureMonitor.js`, `TeamExtractor.js`
- **Performance Issues**: `backoffConfig.js`, `LadderDetector.js`
- **Structure Changes**: `PageStructureMonitor.js`, `PageAnalyzer.js`
- **Data Extraction**: `TeamExtractor.js`, `TeamFetcher.js`

### **Debugging Commands**

```bash
# Enable detailed logging
export DEBUG_LEVEL=verbose

# Use conservative strategy for reliability
export SCRAPER_BACKOFF_STRATEGY=conservative

# Reset performance metrics
# Call resetPerformanceMetrics() in code
```

### **Getting Help**

1. **Check Logs**: Review detailed logging output
2. **Verify Configuration**: Confirm environment variables
3. **Test Selectors**: Validate selectors manually
4. **Check Structure**: Verify page structure hasn't changed
5. **Review Alerts**: Check for structure change notifications
6. **Document Issue**: Record symptoms and attempted solutions

This comprehensive system provides robust team scraping with intelligent monitoring, adaptive performance, and detailed troubleshooting capabilities.
