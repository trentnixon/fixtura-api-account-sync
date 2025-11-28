# Configuration Guide

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Environment Configuration
NODE_ENV=development

# API Configuration
FIXTURA_API=http://127.0.0.1:1337
FIXTURA_TOKEN=your_api_token_here

# API Settings
API_TIMEOUT=30000
API_RETRY_ATTEMPTS=3

# Logging
LOG_LEVEL=info
```

## Required Variables

- `NODE_ENV`: Set to 'development' or 'production'
- `FIXTURA_TOKEN`: Your API authentication token
- `FIXTURA_API`: Base URL for your API (defaults to http://127.0.0.1:1337)

## Optional Variables

- `API_TIMEOUT`: API request timeout in milliseconds (default: 30000)
- `API_RETRY_ATTEMPTS`: Number of retry attempts for failed requests (default: 3)
- `LOG_LEVEL`: Logging level (default: info)

## Decodo Proxy Configuration (Optional)

Proxy configuration for bypassing IP-based CAPTCHA detection:

- `DECODO_PROXY_ENABLED`: Set to `true` to enable proxy (default: disabled)
- `DECODO_PROXY_SERVER`: Proxy server and ports in format `host:port1,port2,port3`
  - Example: `dc.decodo.com:10001,10002,10003,10004,10005,10006,10007,10008,10009,10010`
  - Supports multiple ports for automatic rotation
- `DECODO_PROXY_USERNAME`: Your Decodo username
- `DECODO_PROXY_PASSWORD`: Your Decodo password
- `DECODO_ROTATE_ON_RESTART`: Rotate through ports on browser restart (default: `true`)

**Note:** The system will automatically rotate through all configured ports on each browser restart to distribute load and reduce IP blocking.

## Troubleshooting Connection Issues

If you're getting "ECONNREFUSED" errors:

1. **Check if your API server is running**

   - Ensure Strapi or your API server is started
   - Verify the port number in FIXTURA_API

2. **Verify environment variables**

   - Check that .env file exists and is properly formatted
   - Ensure FIXTURA_API points to the correct server

3. **Check network configuration**
   - Verify firewall settings
   - Check if the server is accessible from your machine

## Development vs Production

- **Development**: Use localhost or 127.0.0.1 for local development
- **Production**: Use your production server URL
- **Staging**: Use your staging server URL

## Example Configurations

### Local Development

```bash
NODE_ENV=development
FIXTURA_API=http://127.0.0.1:1337
FIXTURA_TOKEN=dev_token_here
```

### Production

```bash
NODE_ENV=production
FIXTURA_API=https://api.yourdomain.com
FIXTURA_TOKEN=prod_token_here
```
