# Proxy Setup Guide for Heroku

This guide shows you how to configure proxies to bypass IP-based CAPTCHA detection.

---

## 🚀 Quick Start

### Step 1: Choose a Proxy Service

**Recommended**: Start with **Smartproxy** ($75/month)

- Good balance of cost and quality
- Easy setup
- Residential IPs reduce CAPTCHA

**Alternatives**:

- **IPRoyal**: Pay-as-you-go ($1.75/GB) - good for testing
- **Oxylabs**: $300/month - better quality
- **Bright Data**: $500+/month - enterprise grade

### Step 2: Get Your Proxy Credentials

After signing up, you'll get:

- Proxy server address (e.g., `gate.smartproxy.com:10000`)
- Username
- Password

### Step 3: Configure on Heroku

#### Option A: Single Proxy (Simplest)

```powershell
# Set single proxy
heroku config:set PROXY_SERVER=gate.smartproxy.com:10000 -a fixtura-api-account-sync
heroku config:set PROXY_USERNAME=your-username -a fixtura-api-account-sync
heroku config:set PROXY_PASSWORD=your-password -a fixtura-api-account-sync
```

#### Option B: Multiple Proxies (Rotation)

```powershell
# Set proxy list (comma-separated)
heroku config:set PROXY_LIST="gate.smartproxy.com:10000,gate.smartproxy.com:10001,gate.smartproxy.com:10002" -a fixtura-api-account-sync
heroku config:set PROXY_USERNAME=your-username -a fixtura-api-account-sync
heroku config:set PROXY_PASSWORD=your-password -a fixtura-api-account-sync
```

#### Option C: Numbered Proxies (Advanced)

```powershell
# Set individual proxies
heroku config:set PROXY_1_SERVER=gate.smartproxy.com:10000 -a fixtura-api-account-sync
heroku config:set PROXY_1_USERNAME=username1 -a fixtura-api-account-sync
heroku config:set PROXY_1_PASSWORD=password1 -a fixtura-api-account-sync

heroku config:set PROXY_2_SERVER=gate.smartproxy.com:10001 -a fixtura-api-account-sync
heroku config:set PROXY_2_USERNAME=username2 -a fixtura-api-account-sync
heroku config:set PROXY_2_PASSWORD=password2 -a fixtura-api-account-sync
```

### Step 4: Deploy and Test

```powershell
# Commit and push
git add .
git commit -m "Add proxy support for CAPTCHA bypass"
git push heroku master

# Monitor logs
heroku logs --tail -a fixtura-api-account-sync
```

Look for:

- `"Proxy pool initialized"` - confirms proxy is configured
- `"Using proxy for browser launch"` - confirms proxy is being used
- No CAPTCHA errors

---

## 📋 Environment Variable Reference

### Single Proxy Configuration

| Variable         | Description                   | Example                     |
| ---------------- | ----------------------------- | --------------------------- |
| `PROXY_SERVER`   | Proxy server address and port | `gate.smartproxy.com:10000` |
| `PROXY_USERNAME` | Proxy username                | `your-username`             |
| `PROXY_PASSWORD` | Proxy password                | `your-password`             |

### Multiple Proxies (List)

| Variable         | Description                     | Example                                               |
| ---------------- | ------------------------------- | ----------------------------------------------------- |
| `PROXY_LIST`     | Comma-separated proxy servers   | `gate.smartproxy.com:10000,gate.smartproxy.com:10001` |
| `PROXY_USERNAME` | Shared username for all proxies | `your-username`                                       |
| `PROXY_PASSWORD` | Shared password for all proxies | `your-password`                                       |

### Numbered Proxies (Advanced)

| Variable           | Description           | Example                     |
| ------------------ | --------------------- | --------------------------- |
| `PROXY_1_SERVER`   | First proxy server    | `gate.smartproxy.com:10000` |
| `PROXY_1_USERNAME` | First proxy username  | `username1`                 |
| `PROXY_1_PASSWORD` | First proxy password  | `password1`                 |
| `PROXY_2_SERVER`   | Second proxy server   | `gate.smartproxy.com:10001` |
| `PROXY_2_USERNAME` | Second proxy username | `username2`                 |
| `PROXY_2_PASSWORD` | Second proxy password | `password2`                 |

---

## 🔍 Verify Proxy Configuration

### Check Current Config

```powershell
# View all proxy-related config vars
heroku config -a fixtura-api-account-sync | grep PROXY
```

### Test Proxy Connection

After deployment, check logs:

```powershell
heroku logs --tail -a fixtura-api-account-sync | grep -i proxy
```

You should see:

```
Proxy pool initialized with single proxy
Using proxy for browser launch
Proxy authentication configured
Puppeteer browser launched { proxyEnabled: true }
```

---

## 🎯 Proxy Service Examples

### Smartproxy Setup

```powershell
heroku config:set PROXY_SERVER=gate.smartproxy.com:10000 -a fixtura-api-account-sync
heroku config:set PROXY_USERNAME=your-username -a fixtura-api-account-sync
heroku config:set PROXY_PASSWORD=your-password -a fixtura-api-account-sync
```

### Bright Data Setup

```powershell
heroku config:set PROXY_SERVER=zproxy.lum-superproxy.io:22225 -a fixtura-api-account-sync
heroku config:set PROXY_USERNAME=customer-USERNAME-zone-ZONE -a fixtura-api-account-sync
heroku config:set PROXY_PASSWORD=your-password -a fixtura-api-account-sync
```

### Oxylabs Setup

```powershell
heroku config:set PROXY_SERVER=pr.oxylabs.io:7777 -a fixtura-api-account-sync
heroku config:set PROXY_USERNAME=customer-USERNAME -a fixtura-api-account-sync
heroku config:set PROXY_PASSWORD=your-password -a fixtura-api-account-sync
```

---

## 🔄 Proxy Rotation

If you configure multiple proxies, the system will automatically rotate through them:

- **First request**: Uses proxy 1
- **Second request**: Uses proxy 2
- **Third request**: Uses proxy 3
- **Fourth request**: Cycles back to proxy 1

This helps avoid rate limiting and IP-based detection.

---

## 🛠️ Troubleshooting

### Proxy Not Working

1. **Check credentials**:

   ```powershell
   heroku config:get PROXY_SERVER -a fixtura-api-account-sync
   heroku config:get PROXY_USERNAME -a fixtura-api-account-sync
   ```

2. **Check logs for errors**:

   ```powershell
   heroku logs --tail -a fixtura-api-account-sync | grep -i "proxy\|error"
   ```

3. **Verify proxy format**: Should be `host:port` (e.g., `gate.smartproxy.com:10000`)

### Still Getting CAPTCHA

1. **Try different proxy**: Some proxies may be flagged
2. **Use residential proxies**: Better than datacenter proxies
3. **Rotate more frequently**: Use multiple proxies
4. **Check proxy service status**: Some services have downtime

### Connection Timeouts

1. **Check proxy server address**: Ensure it's correct
2. **Verify port number**: Common ports are 10000, 8080, 3128
3. **Check firewall**: Heroku should allow outbound connections
4. **Try different proxy**: Current proxy may be down

---

## 💡 Best Practices

1. **Start with single proxy** to test
2. **Use residential proxies** for better success rates
3. **Rotate proxies** for high-volume scraping
4. **Monitor usage** to avoid unexpected costs
5. **Keep credentials secure** - never commit to git
6. **Test locally first** if possible

---

## 📊 Monitoring

After setup, monitor:

```powershell
# Watch for proxy usage
heroku logs --tail -a fixtura-api-account-sync | grep -i proxy

# Watch for CAPTCHA errors
heroku logs --tail -a fixtura-api-account-sync | grep -i captcha

# Watch for connection errors
heroku logs --tail -a fixtura-api-account-sync | grep -i "connection\|timeout"
```

---

## 🔐 Security Notes

- ✅ **DO**: Store proxy credentials in Heroku config vars
- ✅ **DO**: Use environment variables, never hardcode
- ❌ **DON'T**: Commit proxy credentials to git
- ❌ **DON'T**: Share proxy credentials in logs
- ✅ **DO**: Rotate credentials periodically

---

## 📞 Next Steps

1. **Choose a proxy service** (recommend Smartproxy)
2. **Sign up and get credentials**
3. **Configure on Heroku** using the commands above
4. **Deploy the code** (already done - proxy support is implemented)
5. **Test and monitor** for CAPTCHA issues
6. **Adjust as needed** (try different proxies, add more for rotation)

---

## 🎯 Expected Results

After setup, you should see:

- ✅ No CAPTCHA errors in logs
- ✅ Successful page loads
- ✅ Proxy rotation working (if multiple proxies)
- ✅ Reduced IP-based blocking

If CAPTCHA still appears, it may be:

- Browser fingerprinting (enhanced evasions should help)
- Rate limiting (add delays between requests)
- Advanced detection (may need CAPTCHA solving service)
