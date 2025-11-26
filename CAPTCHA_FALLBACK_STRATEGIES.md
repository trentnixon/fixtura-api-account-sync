# CAPTCHA Fallback Strategies

If the current Puppeteer v24 + stealth plugin approach doesn't work on Heroku, here are alternative strategies ordered by complexity and cost.

---

## 🟢 Level 1: Enhanced Evasions (Free, Easy)

### Strategy 1.1: Add More Page-Level Evasions

Enhance `PuppeteerManager.createPageInNewContext()` with additional evasions:

```javascript
// Add after existing evasions in createPageInNewContext()
await page.evaluateOnNewDocument(() => {
  // Override chrome property (critical for detection)
  window.chrome = {
    runtime: {},
    loadTimes: function () {},
    csi: function () {},
    app: {},
  };

  // Override permissions API
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === "notifications"
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);

  // Override iframe contentWindow
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    get: function () {
      return window;
    },
  });

  // Override toString methods
  window.navigator.webdriver = undefined;
  delete window.navigator.__proto__.webdriver;
});
```

### Strategy 1.2: Add Request Headers

Set realistic headers on every request:

```javascript
// In createPageInNewContext(), after setting user agent:
await page.setExtraHTTPHeaders({
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "max-age=0",
});
```

### Strategy 1.3: Randomize Viewport Sizes

Use realistic, randomized viewports:

```javascript
// In createPageInNewContext(), replace fixed viewport:
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
];

const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
await page.setViewport({
  ...randomViewport,
  deviceScaleFactor: 1,
});
```

### Strategy 1.4: Add Mouse Movement Simulation

Simulate human-like mouse movements:

```javascript
// Helper function to add to PuppeteerManager
async simulateHumanBehavior(page) {
  // Random mouse movements
  await page.mouse.move(
    Math.random() * 1000,
    Math.random() * 1000,
    { steps: 10 }
  );

  // Random scroll
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 500);
  });

  // Random wait
  await page.waitForTimeout(Math.random() * 2000 + 1000);
}
```

---

## 🟡 Level 2: Proxy Services (Paid, Moderate)

### Strategy 2.1: Residential Proxy Services

Use services like Bright Data, Smartproxy, or Oxylabs:

```javascript
// In PuppeteerManager.launchBrowser(), add proxy support:
async launchBrowser(proxyConfig = null) {
  const args = [
    // ... existing args
  ];

  if (proxyConfig) {
    args.push(`--proxy-server=${proxyConfig.server}`);
  }

  this.browser = await puppeteer.launch({
    // ... existing config
    args,
  });

  // Authenticate proxy if needed
  if (proxyConfig && proxyConfig.username) {
    const page = await this.browser.newPage();
    await page.authenticate({
      username: proxyConfig.username,
      password: proxyConfig.password,
    });
    await page.close();
  }
}
```

**Recommended Services:**

- **Bright Data** (formerly Luminati): $500+/month, high quality
- **Smartproxy**: $75+/month, good balance
- **Oxylabs**: $300+/month, enterprise-grade
- **Proxy-Cheap**: $50+/month, budget option

### Strategy 2.2: Rotating Proxies

Implement proxy rotation per request:

```javascript
// Create proxy pool manager
class ProxyPool {
  constructor(proxies) {
    this.proxies = proxies;
    this.currentIndex = 0;
  }

  getNext() {
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
}

// Use in PuppeteerManager
const proxyPool = new ProxyPool([
  { server: "proxy1:port", username: "user1", password: "pass1" },
  { server: "proxy2:port", username: "user2", password: "pass2" },
  // ... more proxies
]);

// Create new browser instance per request with different proxy
```

---

## 🟠 Level 3: CAPTCHA Solving Services (Paid, Easy Integration)

### Strategy 3.1: 2Captcha API

Automatically solve CAPTCHAs when detected:

```javascript
// Install: npm install 2captcha
const Captcha = require("2captcha");

const solver = new Captcha.Solver("YOUR_API_KEY");

// Detect CAPTCHA and solve
async function solveCaptcha(page) {
  // Check if CAPTCHA exists
  const captchaExists = await page.$('iframe[src*="recaptcha"]');

  if (captchaExists) {
    // Get site key
    const siteKey = await page.evaluate(() => {
      return document
        .querySelector("[data-sitekey]")
        ?.getAttribute("data-sitekey");
    });

    // Solve CAPTCHA
    const solution = await solver.recaptcha({
      pageurl: page.url(),
      googlekey: siteKey,
    });

    // Inject solution
    await page.evaluate((token) => {
      document.getElementById("g-recaptcha-response").innerHTML = token;
      const callback =
        window[
          Object.keys(window).find((key) => key.startsWith("___grecaptcha_cfg"))
        ];
      if (callback) callback();
    }, solution.data);
  }
}
```

**Services:**

- **2Captcha**: $2.99 per 1000 CAPTCHAs
- **Anti-Captcha**: $1.39 per 1000 CAPTCHAs
- **CapSolver**: $1.20 per 1000 CAPTCHAs

### Strategy 3.2: Browser Extension Approach

Use browser extensions that solve CAPTCHAs automatically (requires non-headless mode or special setup).

---

## 🔴 Level 4: Alternative Approaches (Complex, May Require Architecture Changes)

### Strategy 4.1: Playwright with Stealth

Switch from Puppeteer to Playwright with stealth:

```javascript
// Install: npm install playwright playwright-extra playwright-extra-plugin-stealth
const { chromium } = require("playwright-extra");
const StealthPlugin = require("playwright-extra-plugin-stealth")();

chromium.use(StealthPlugin);

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
```

**Pros:** Better stealth capabilities, more modern
**Cons:** Requires code migration

### Strategy 4.2: Selenium with Undetected ChromeDriver

Use Selenium with undetected-chromedriver:

```javascript
// Install: npm install selenium-webdriver undetected-chromedriver
const uc = require("undetected-chromedriver");

const driver = await uc({
  headless: true,
  userDataDir: false,
});
```

**Pros:** Very effective at bypassing detection
**Cons:** Different API, requires migration

### Strategy 4.3: API-Based Scraping

If the target site has an API, use it instead:

```javascript
// Instead of scraping, use API endpoints
// Many sites have internal APIs that are easier to access
const response = await fetch("https://target-site.com/api/endpoint", {
  headers: {
    "User-Agent": "Mozilla/5.0...",
    Referer: "https://target-site.com",
    // ... other headers
  },
});
```

**Pros:** Faster, more reliable, no CAPTCHA
**Cons:** May violate ToS, endpoints may change

### Strategy 4.4: Headless Browser Services

Use cloud-based browser services:

- **Browserless.io**: $75+/month
- **ScraperAPI**: $49+/month
- **ScrapingBee**: $49+/month

These services handle CAPTCHAs and proxies for you.

---

## 🟣 Level 5: Advanced Techniques (Expert Level)

### Strategy 5.1: Browser Fingerprint Randomization

Randomize all browser characteristics:

```javascript
// Create a fingerprint randomizer
class FingerprintRandomizer {
  static getRandomUserAgent() {
    const agents = [
      // Windows Chrome
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      // Mac Chrome
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      // Linux Chrome
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  static getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  static getRandomTimezone() {
    const timezones = [
      "America/New_York",
      "America/Los_Angeles",
      "America/Chicago",
      "Europe/London",
      "Europe/Paris",
    ];
    return timezones[Math.floor(Math.random() * timezones.length)];
  }
}
```

### Strategy 5.2: Request Timing Randomization

Add random delays to mimic human behavior:

```javascript
// Add delays between requests
async function humanLikeDelay() {
  const delay = Math.random() * 3000 + 2000; // 2-5 seconds
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// Use before navigation
await humanLikeDelay();
await page.goto(url);
```

### Strategy 5.3: Cookie and Session Management

Maintain persistent sessions:

```javascript
// Save and restore cookies
async function saveCookies(page, filePath) {
  const cookies = await page.cookies();
  await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page, filePath) {
  const cookies = JSON.parse(await fs.readFile(filePath));
  await page.setCookie(...cookies);
}

// Use before navigation
await loadCookies(page, "./cookies.json");
await page.goto(url);
await saveCookies(page, "./cookies.json");
```

---

## 📊 Decision Matrix

| Strategy            | Cost       | Complexity | Effectiveness | Time to Implement |
| ------------------- | ---------- | ---------- | ------------- | ----------------- |
| Enhanced Evasions   | Free       | Low        | Medium        | 1-2 hours         |
| Residential Proxies | $50-500/mo | Medium     | High          | 2-4 hours         |
| CAPTCHA Solving     | $1-3/1000  | Low        | Very High     | 1-2 hours         |
| Playwright Switch   | Free       | High       | High          | 1-2 days          |
| Browser Services    | $50-200/mo | Low        | Very High     | 1-2 hours         |
| Fingerprint Random  | Free       | Medium     | Medium        | 3-4 hours         |

---

## 🎯 Recommended Implementation Order

1. **First**: Try enhanced evasions (Level 1) - free and quick
2. **Second**: Add CAPTCHA solving service (Level 3) - cheap and effective
3. **Third**: Add residential proxies (Level 2) - if budget allows
4. **Last Resort**: Consider architecture changes (Level 4)

---

## 🔧 Quick Implementation: Enhanced Evasions

Here's a ready-to-use enhanced version you can add to `PuppeteerManager`:

```javascript
// Add this method to PuppeteerManager class
async configurePageForStealth(page) {
  // Set user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  // Set viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Set headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  // Advanced evasions
  await page.evaluateOnNewDocument(() => {
    // Chrome object
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };

    // Permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}
```

Then call it in `createPageInNewContext()`:

```javascript
async createPageInNewContext() {
  await this.launchBrowser();
  const page = await this.browser.newPage();
  await this.configurePageForStealth(page);
  this.addDisposable(page);
  return page;
}
```

---

## 📝 Monitoring and Testing

After implementing any strategy, monitor:

```powershell
# Watch for CAPTCHA in logs
heroku logs --tail -a fixtura-api-account-sync | grep -i captcha

# Monitor success rate
heroku logs --tail -a fixtura-api-account-sync | grep -i "success\|error"
```

---

## 💡 Pro Tips

1. **Combine Strategies**: Use multiple strategies together (e.g., proxies + CAPTCHA solving)
2. **Rate Limiting**: Add delays between requests to avoid triggering rate limits
3. **IP Rotation**: If using proxies, rotate IPs frequently
4. **User-Agent Rotation**: Rotate user agents to avoid patterns
5. **Session Persistence**: Maintain cookies/sessions to look more legitimate
6. **Error Handling**: Have fallback strategies when CAPTCHA appears

---

## 🚨 Legal and Ethical Considerations

- Always check the target site's Terms of Service
- Respect robots.txt
- Don't overload servers with requests
- Consider reaching out to site owners for API access
- Use reasonable rate limits

---

## 📞 Next Steps

1. **Test current solution** on Heroku first
2. **If CAPTCHA appears**, implement Level 1 enhancements immediately
3. **If still failing**, add CAPTCHA solving service (Level 3) - fastest ROI
4. **For long-term**, consider residential proxies (Level 2) if budget allows
