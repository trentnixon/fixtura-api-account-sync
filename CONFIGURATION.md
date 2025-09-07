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
