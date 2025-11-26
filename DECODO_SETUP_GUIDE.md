# Decodo Proxy Integration Guide

This guide shows you how to integrate Decodo proxy service with your Puppeteer scraping application to bypass IP-based CAPTCHA detection.

---

## 🎯 What is Decodo?

Decodo is a proxy service specifically designed for web scraping. It provides:

- Residential and datacenter proxies
- Rotating IP addresses
- Easy Puppeteer integration
- Good success rates for bypassing CAPTCHA

---

## 📋 Step 1: Sign Up for Decodo

1. Visit [Decodo's website](https://decodo.com/scraping/web)
2. Sign up for an account
3. Choose a plan that fits your needs
4. Access your dashboard to get proxy credentials

---

## 🔑 Step 2: Get Your Proxy Credentials

After signing up, you'll receive:

- **Proxy Server**: `proxy.decodo.com:8080` (example)
- **Username**: Your Decodo username
- **Password**: Your Decodo password

**Note**: Decodo may also support IP whitelisting as an alternative to username/password.

---

## ⚙️ Step 3: Configure on Heroku

Set the following environment variables on Heroku:

```powershell
# Set Decodo proxy server (format: host:port)
heroku config:set DECODO_PROXY_SERVER=proxy.decodo.com:8080 -a fixtura-api-account-sync

# Set Decodo credentials
heroku config:set DECODO_PROXY_USERNAME=your-decodo-username -a fixtura-api-account-sync
heroku config:set DECODO_PROXY_PASSWORD=your-decodo-password -a fixtura-api-account-sync
```

**Replace with your actual Decodo credentials!**

---

## ✅ Step 4: Verify Configuration

Check that your config vars are set:

```powershell
heroku config -a fixtura-api-account-sync | grep DECODO
```

You should see:

```
DECODO_PROXY_PASSWORD: your-password
DECODO_PROXY_SERVER: proxy.decodo.com:8080
DECODO_PROXY_USERNAME: your-username
```

---

## 🚀 Step 5: Deploy and Test

```powershell
# Commit and push
git add dataProcessing/puppeteer/PuppeteerManager.js
git commit -m "Add Decodo proxy support"
git push heroku master

# Monitor logs
heroku logs --tail -a fixtura-api-account-sync
```

Look for these log messages:

- `"Decodo proxy configured"` - Proxy server is set
- `"Decodo proxy authentication configured"` - Credentials are working
- `"Puppeteer browser launched { proxyEnabled: true }"` - Proxy is active

---

## 🔍 Step 6: Test Proxy Connection

After deployment, trigger a test scrape and check:

1. **No CAPTCHA errors** - Proxy should help bypass IP-based detection
2. **Successful page loads** - Requests should route through Decodo
3. **Logs show proxy usage** - Check Heroku logs for proxy confirmation

---

## 🛠️ Troubleshooting

### Proxy Not Working

1. **Verify credentials**:

   ```powershell
   heroku config:get DECODO_PROXY_SERVER -a fixtura-api-account-sync
   heroku config:get DECODO_PROXY_USERNAME -a fixtura-api-account-sync
   ```

2. **Check proxy format**: Should be `host:port` (e.g., `proxy.decodo.com:8080`)

3. **Test connection**: Verify your Decodo account is active and has credits

### Still Getting CAPTCHA

1. **Try different proxy**: Some proxies may be flagged
2. **Check Decodo dashboard**: Ensure your account has available bandwidth
3. **Contact Decodo support**: They can help with connection issues

### Connection Timeouts

1. **Verify proxy server address**: Check Decodo dashboard for correct endpoint
2. **Check firewall**: Heroku should allow outbound connections
3. **Try different port**: Decodo may offer multiple ports

---

## 💡 Best Practices

1. **Start with testing**: Use Decodo's test/trial plan first
2. **Monitor usage**: Track bandwidth to avoid unexpected costs
3. **Keep credentials secure**: Never commit to git, use Heroku config vars
4. **Rotate if needed**: Decodo may offer IP rotation features
5. **Monitor logs**: Watch for proxy-related errors

---

## 🔄 Disabling Decodo

To disable proxy (run without proxy):

```powershell
# Remove proxy config vars
heroku config:unset DECODO_PROXY_SERVER -a fixtura-api-account-sync
heroku config:unset DECODO_PROXY_USERNAME -a fixtura-api-account-sync
heroku config:unset DECODO_PROXY_PASSWORD -a fixtura-api-account-sync
```

The code will automatically detect missing proxy config and run without proxy.

---

## 📊 Expected Results

After setup, you should see:

- ✅ No CAPTCHA errors in logs
- ✅ Successful page loads
- ✅ Proxy authentication working
- ✅ Reduced IP-based blocking

---

## 📞 Additional Resources

- [Decodo Website](https://decodo.com/scraping/web)
- [Decodo Puppeteer Integration Guide](https://help.decodo.com/docs/puppeteer-integration)
- [Decodo Support](https://help.decodo.com)

---

## 🔐 Security Notes

- ✅ **DO**: Store credentials in Heroku config vars
- ✅ **DO**: Use environment variables, never hardcode
- ❌ **DON'T**: Commit proxy credentials to git
- ❌ **DON'T**: Share credentials in logs or messages
- ✅ **DO**: Rotate credentials periodically if possible

---

## 🎯 Next Steps

1. **Sign up for Decodo** and get credentials
2. **Set Heroku config vars** using the commands above
3. **Deploy the code** (already done - proxy support is implemented)
4. **Test and monitor** for CAPTCHA issues
5. **Adjust as needed** based on results

The code is ready - just add your Decodo credentials to Heroku!
