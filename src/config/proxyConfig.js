/**
 * Proxy Configuration Utilities
 * Handles parsing and validation of Decodo proxy settings
 */

/**
 * Decodo Proxy Configuration
 * Ports range from 10001 to 10100 (100 ports total)
 */
const DECODO_PROXY_CONFIG = {
  host: "dc.decodo.com",
  portRange: {
    start: 10001,
    end: 10100,
  },
};

/**
 * Generate port array from range
 * @param {number} start - Starting port number
 * @param {number} end - Ending port number (inclusive)
 * @returns {string[]} Array of port numbers as strings
 */
const generatePortsFromRange = (start, end) => {
  const ports = [];
  for (let i = start; i <= end; i++) {
    ports.push(i.toString());
  }
  return ports;
};

/**
 * Parse proxy server string into host and ports
 * @param {string} proxyServerString - Format: "host:port" or "host:port1,port2,port3"
 * @returns {{host: string, ports: string[]}} Parsed host and ports array
 * @deprecated Use DECODO_PROXY_CONFIG and generatePortsFromRange instead
 */
const parseProxyServer = (proxyServerString) => {
  if (!proxyServerString || typeof proxyServerString !== "string") {
    return { host: "", ports: [] };
  }

  const parts = proxyServerString.split(":");
  if (parts.length < 2) {
    return { host: "", ports: [] };
  }

  const host = parts[0].trim();
  const portsString = parts.slice(1).join(":");
  const ports = portsString
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !isNaN(Number(p)));

  return { host, ports };
};

/**
 * Build proxy configuration object from environment variables
 * Uses DECODO_PROXY_CONFIG for host and port range, but allows override via env vars
 * @param {Object} env - Environment variables object
 * @returns {Object} Proxy configuration object
 */
const buildProxyConfig = (env) => {
  // Allow host override via environment variable, otherwise use config
  const host = env.DECODO_PROXY_HOST || DECODO_PROXY_CONFIG.host;

  // Allow port range override via environment variables
  // DECODO_PROXY_PORT_START and DECODO_PROXY_PORT_END
  const portStart = env.DECODO_PROXY_PORT_START
    ? parseInt(env.DECODO_PROXY_PORT_START, 10)
    : DECODO_PROXY_CONFIG.portRange.start;
  const portEnd = env.DECODO_PROXY_PORT_END
    ? parseInt(env.DECODO_PROXY_PORT_END, 10)
    : DECODO_PROXY_CONFIG.portRange.end;

  // Validate port range
  if (isNaN(portStart) || isNaN(portEnd) || portStart < 1 || portEnd < portStart) {
    throw new Error(
      `Invalid proxy port range: ${portStart}-${portEnd}. Must be valid numbers with start <= end.`
    );
  }

  // Generate ports from configured range
  const ports = generatePortsFromRange(portStart, portEnd);

  // Build server string for display/logging (first 5 ports as example)
  const serverDisplay = `${host}:${ports.slice(0, 5).join(",")}... (${
    ports.length
  } ports)`;

  return {
    enabled: env.DECODO_PROXY_ENABLED === "true",
    host,
    ports,
    portRange: { start: portStart, end: portEnd },
    server: serverDisplay, // Display string instead of full port list
    username: env.DECODO_PROXY_USERNAME || "",
    password: env.DECODO_PROXY_PASSWORD || "",
    rotateOnRestart: env.DECODO_ROTATE_ON_RESTART !== "false",
    currentPortIndex: 0,
  };
};

/**
 * Build proxy server URL from host and port
 * NOTE: Do NOT include credentials in URL - use page.authenticate() instead
 * Chrome doesn't support credentials in proxy URL for HTTPS connections
 * @param {string} host - Proxy host
 * @param {string} port - Proxy port
 * @returns {string|null} Proxy server URL or null if invalid
 */
const getProxyServerUrl = (host, port) => {
  if (!host || !port) return null;
  return `http://${host}:${port}`;
};

/**
 * Check if proxy configuration is valid and enabled
 * @param {Object} config - Proxy configuration object
 * @returns {boolean} True if proxy is enabled and valid
 */
const isProxyConfigValid = (config) => {
  return config.enabled && config.host && config.ports.length > 0;
};

/**
 * Get display string for proxy configuration
 * @param {Object} config - Proxy configuration object
 * @returns {string} Display string for logging
 */
const getProxyConfigDisplay = (config) => {
  if (!isProxyConfigValid(config)) {
    return "Invalid";
  }

  const portInfo =
    config.ports.length === 1
      ? config.ports[0]
      : `${config.ports.length} ports (${config.ports.join(", ")})`;

  return `${config.host}:${portInfo}`;
};

module.exports = {
  DECODO_PROXY_CONFIG,
  generatePortsFromRange,
  parseProxyServer,
  buildProxyConfig,
  getProxyServerUrl,
  isProxyConfigValid,
  getProxyConfigDisplay,
};
