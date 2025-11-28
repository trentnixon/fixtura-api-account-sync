/**
 * Proxy Configuration Utilities
 * Handles parsing and validation of Decodo proxy settings
 */

/**
 * Parse proxy server string into host and ports
 * @param {string} proxyServerString - Format: "host:port" or "host:port1,port2,port3"
 * @returns {{host: string, ports: string[]}} Parsed host and ports array
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
 * @param {Object} env - Environment variables object
 * @returns {Object} Proxy configuration object
 */
const buildProxyConfig = (env) => {
  const proxyServer = env.DECODO_PROXY_SERVER || "";
  const { host, ports } = parseProxyServer(proxyServer);

  return {
    enabled: env.DECODO_PROXY_ENABLED === "true",
    host,
    ports,
    server: proxyServer,
    username: env.DECODO_PROXY_USERNAME || "",
    password: env.DECODO_PROXY_PASSWORD || "",
    rotateOnRestart: env.DECODO_ROTATE_ON_RESTART !== "false",
    currentPortIndex: 0,
  };
};

/**
 * Build proxy server URL from host and port
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
  parseProxyServer,
  buildProxyConfig,
  getProxyServerUrl,
  isProxyConfigValid,
  getProxyConfigDisplay,
};
