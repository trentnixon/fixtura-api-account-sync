# Proxy Options Guide for IP-Based CAPTCHA Detection

If the CAPTCHA is triggered by IP detection (IP sniffer), you need to use proxies to rotate your IP address.

---

## 🎯 Proxy Service Options

### Budget-Friendly Options ($50-100/month)

#### 1. **Smartproxy** (Recommended for Balance)

- **Price**: $75/month (10GB), $200/month (50GB)
- **Type**: Residential + Datacenter
- **Features**:
  - Rotating IPs
  - Country targeting
  - Good success rate
  - Easy API integration
- **Best for**: Medium volume scraping
- **Website**: smartproxy.com

#### 2. **Proxy-Cheap**

- **Price**: $50/month (5GB), $100/month (15GB)
- **Type**: Residential
- **Features**: Basic rotation, decent quality
- **Best for**: Budget-conscious projects
- **Website**: proxy-cheap.com

#### 3. **Bright Data** (Premium)

- **Price**: $500+/month
- **Type**: Residential (highest quality)
- **Features**:
  - Best success rate
  - Enterprise-grade
  - Advanced targeting
- **Best for**: High-volume, critical operations
- **Website**: brightdata.com

#### 4. **Oxylabs**

- **Price**: $300+/month
- **Type**: Residential + Datacenter
- **Features**: Good balance of quality and features
- **Best for**: Professional scraping operations
- **Website**: oxylabs.io

#### 5. **IPRoyal** (Budget)

- **Price**: $1.75/GB (pay-as-you-go)
- **Type**: Residential
- **Features**: Flexible pricing, good for testing
- **Best for**: Low-volume or testing
- **Website**: iproyal.com

---

## 🔧 Implementation Options

### Option 1: Single Proxy (Simplest)

Use one proxy for all requests. Good for testing.

**Pros**: Simple, cheap
**Cons**: Single point of failure, may get blocked

### Option 2: Proxy Rotation (Recommended)

Rotate through multiple proxies automatically.

**Pros**: Better success rate, harder to detect
**Cons**: More complex, higher cost

### Option 3: Per-Request Proxy (Best for High Volume)

Use different proxy for each request/page.

**Pros**: Maximum success rate, best for avoiding detection
**Cons**: Most complex, highest cost

---

## 📋 Proxy Format Examples

### Smartproxy Format

```
gate.smartproxy.com:10000
Username: username
Password: password
```

### Bright Data Format

```
zproxy.lum-superproxy.io:22225
Username: customer-USERNAME-zone-ZONE
Password: PASSWORD
```

### Generic HTTP Proxy Format

```
proxy.example.com:8080
Username: user
Password: pass
```

### SOCKS5 Proxy Format

```
socks5://proxy.example.com:1080
Username: user
Password: pass
```

---

## 💰 Cost Comparison

| Service     | Monthly Cost | Bandwidth     | Best For        |
| ----------- | ------------ | ------------- | --------------- |
| IPRoyal     | $1.75/GB     | Pay-as-you-go | Testing         |
| Proxy-Cheap | $50-100      | 5-15GB        | Budget          |
| Smartproxy  | $75-200      | 10-50GB       | **Recommended** |
| Oxylabs     | $300+        | 50GB+         | Professional    |
| Bright Data | $500+        | 100GB+        | Enterprise      |

---

## 🎯 Recommendation

**For your use case (Heroku scraping with CAPTCHA issues):**

1. **Start with Smartproxy** ($75/month)

   - Good balance of cost and quality
   - Easy integration
   - Residential IPs reduce CAPTCHA triggers

2. **If budget allows, upgrade to Oxylabs** ($300/month)

   - Better success rates
   - More reliable
   - Better support

3. **For testing, use IPRoyal** (pay-as-you-go)
   - Test if proxies solve the issue
   - Low commitment
   - Scale up if it works

---

## 🔐 Security Notes

- **Never commit proxy credentials** to git
- Use **environment variables** for all proxy configs
- **Rotate credentials** regularly if possible
- Monitor proxy usage to avoid unexpected costs

---

## 📝 Next Steps

1. Choose a proxy service (recommend Smartproxy to start)
2. Sign up and get your proxy credentials
3. Add proxy config to Heroku environment variables
4. Deploy the proxy-enabled code
5. Monitor success rate and adjust as needed
