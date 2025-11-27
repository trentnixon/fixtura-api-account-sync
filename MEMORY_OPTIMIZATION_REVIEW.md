# Memory Optimization Review - 2GB Memory Available

## Current Aggressive Settings (Optimized for 1GB)

### 1. **Browser Restart Thresholds** (Very Aggressive)

- **Operation Count**: Restart every **3 operations** (line 35)
- **Memory Thresholds**: Restart at **60MB heap** or **150MB RSS** (line 175)
- **Restart Interval**: Minimum **15 seconds** between restarts (line 39)
- **Restart Delay**: **2 seconds** wait after closing browser (line 250)

### 2. **Chrome Performance Flags** (May Slow Things Down)

- `--disable-gpu` (line 67) - Disables GPU acceleration, can slow rendering
- `--disable-software-rasterizer` (line 68) - Can impact performance
- `--disable-images` (line 76) - Blocks images, may slow page rendering
- `--blink-settings=imagesEnabled=false` (line 77) - Same as above
- `--metrics-recording-only` (line 80) - Reduces telemetry

### 3. **Essential Flags** (Keep These)

- `--no-sandbox` - Required for headless
- `--disable-dev-shm-usage` - Prevents shared memory issues
- `--disable-extensions` - Saves memory, no performance impact
- `--disable-plugins` - Saves memory, no performance impact
- `--disable-sync` - Reduces background processes
- `--disable-background-timer-throttling` - Prevents memory leaks
- `--disable-backgrounding-occluded-windows` - Memory optimization
- `--disable-renderer-backgrounding` - Prevents memory accumulation
- `--disable-blink-features=AutomationControlled` - Anti-detection
- `--mute-audio` - No performance impact
- `--disable-notifications` - No performance impact
- `--disable-default-apps` - No performance impact

---

## Recommended Relaxations for 2GB Memory

### ✅ **High Impact - Relax These First**

1. **Operation Count Restart**: `3` → `15-20`

   - **Impact**: Fewer restarts = faster processing
   - **Risk**: Low (with 2GB, can handle more operations)

2. **Memory Thresholds**:

   - Heap: `60MB` → `150MB`
   - RSS: `150MB` → `400MB`
   - **Impact**: Less frequent restarts, faster processing
   - **Risk**: Low (2GB gives plenty of headroom)

3. **Restart Interval**: `15 seconds` → `60 seconds`
   - **Impact**: Less frequent checks = lower CPU usage
   - **Risk**: Low

### ✅ **Medium Impact - Remove Performance-Hindering Flags**

4. **Remove `--disable-gpu`**

   - **Impact**: Enables GPU acceleration, faster rendering
   - **Memory Cost**: ~10-20MB
   - **Risk**: Low

5. **Remove `--disable-software-rasterizer`**

   - **Impact**: Better rendering performance
   - **Memory Cost**: ~5-10MB
   - **Risk**: Low

6. **Remove `--disable-images` and `--blink-settings=imagesEnabled=false`**

   - **Impact**: Faster page loading, proper rendering (some sites need images)
   - **Memory Cost**: ~20-50MB per page with images
   - **Risk**: Medium (depends on how many pages with images)

7. **Remove `--metrics-recording-only`**
   - **Impact**: Minimal, but cleaner
   - **Memory Cost**: ~5MB
   - **Risk**: Low

### ✅ **Low Impact - Minor Optimizations**

8. **Restart Delay**: `2 seconds` → `1 second`
   - **Impact**: Faster restarts
   - **Risk**: Low

---

## Recommended Configuration

```javascript
// Relaxed for 2GB memory
this.maxOperationsBeforeRestart = 15; // Was 3
this.minRestartInterval = 60000; // Was 15000 (60 seconds)

// Memory thresholds
if (heapUsedMB > 150 || rssMB > 400) {
  // Was 60/150
  await this.restartBrowser();
}

// Chrome args - remove performance-hindering flags
args: [
  "--disable-setuid-sandbox",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  // REMOVED: --disable-gpu (enable GPU acceleration)
  // REMOVED: --disable-software-rasterizer (enable rasterizer)
  "--disable-extensions",
  "--disable-plugins",
  "--disable-sync",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-blink-features=AutomationControlled",
  // REMOVED: --disable-images (allow images for proper rendering)
  // REMOVED: --blink-settings=imagesEnabled=false
  "--disable-component-extensions-with-background-pages",
  "--disable-ipc-flooding-protection",
  // REMOVED: --metrics-recording-only (not needed)
  "--mute-audio",
  "--disable-notifications",
  "--disable-default-apps",
];
```

---

## Expected Impact

| Change                            | Speed Improvement                 | Memory Cost   | CPU Impact                       |
| --------------------------------- | --------------------------------- | ------------- | -------------------------------- |
| Operation count: 3→15             | **High** (5x fewer restarts)      | +50-100MB     | **Lower** (fewer restarts)       |
| Memory thresholds: 60/150→150/400 | **High** (less frequent restarts) | +100-200MB    | **Lower** (fewer checks)         |
| Restart interval: 15s→60s         | Medium                            | 0MB           | **Lower** (less frequent checks) |
| Remove --disable-gpu              | **High** (GPU acceleration)       | +10-20MB      | **Lower** (GPU offloads CPU)     |
| Remove --disable-images           | **High** (faster rendering)       | +20-50MB/page | **Lower** (less CPU work)        |
| Restart delay: 2s→1s              | Low                               | 0MB           | **Lower** (faster restarts)      |

**Total Expected Improvement**:

- **Speed**: 3-5x faster processing (fewer restarts)
- **Memory**: +200-400MB usage (well within 2GB limit)
- **CPU**: Lower usage (GPU acceleration, fewer restarts, less frequent checks)

---

## Implementation Priority

1. **Immediate** (High Impact, Low Risk):

   - Increase operation count to 15
   - Increase memory thresholds to 150/400
   - Increase restart interval to 60s

2. **Short Term** (Medium Impact, Low Risk):

   - Remove `--disable-gpu`
   - Remove `--disable-software-rasterizer`
   - Remove `--metrics-recording-only`

3. **Test First** (Medium Impact, Medium Risk):
   - Remove `--disable-images` (test if sites render correctly)
   - Reduce restart delay to 1s

---

## Monitoring After Changes

Watch for:

- Memory usage staying under 1.5GB (75% of 2GB)
- Processing speed improvements
- CPU usage reduction
- Any rendering issues (if images are re-enabled)
