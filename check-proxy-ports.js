#!/usr/bin/env node

/**
 * Diagnostic script to check proxy port configuration
 * Run with: node check-proxy-ports.js
 */

require('dotenv').config();
const { PROXY_CONFIG } = require('./src/config/environment');

console.log('\n=== Proxy Port Configuration Diagnostic ===\n');

console.log('Proxy Enabled:', PROXY_CONFIG.enabled);
console.log('Proxy Host:', PROXY_CONFIG.host);
console.log('Total Ports:', PROXY_CONFIG.ports.length);
console.log('Port Range:', PROXY_CONFIG.portRange ? `${PROXY_CONFIG.portRange.start}-${PROXY_CONFIG.portRange.end}` : 'Not set');

if (PROXY_CONFIG.ports.length > 0) {
  console.log('\nFirst 10 ports:');
  console.log('  ', PROXY_CONFIG.ports.slice(0, 10).join(', '));

  console.log('\nLast 10 ports:');
  console.log('  ', PROXY_CONFIG.ports.slice(-10).join(', '));

  console.log('\nPorts 11-20:');
  console.log('  ', PROXY_CONFIG.ports.slice(10, 20).join(', '));

  console.log('\nPorts 91-100:');
  console.log('  ', PROXY_CONFIG.ports.slice(90, 100).join(', '));

  // Check for duplicates
  const uniquePorts = new Set(PROXY_CONFIG.ports);
  if (uniquePorts.size !== PROXY_CONFIG.ports.length) {
    console.log('\n⚠️  WARNING: Duplicate ports detected!');
    console.log('   Unique ports:', uniquePorts.size);
    console.log('   Total ports:', PROXY_CONFIG.ports.length);
  }

  // Verify port range
  if (PROXY_CONFIG.portRange) {
    const expectedCount = PROXY_CONFIG.portRange.end - PROXY_CONFIG.portRange.start + 1;
    if (PROXY_CONFIG.ports.length !== expectedCount) {
      console.log('\n⚠️  WARNING: Port count mismatch!');
      console.log('   Expected:', expectedCount);
      console.log('   Actual:', PROXY_CONFIG.ports.length);
    } else {
      console.log('\n✅ Port count matches expected range');
    }
  }

  // Check if ports are sequential
  let sequential = true;
  for (let i = 0; i < PROXY_CONFIG.ports.length - 1; i++) {
    const current = parseInt(PROXY_CONFIG.ports[i], 10);
    const next = parseInt(PROXY_CONFIG.ports[i + 1], 10);
    if (next !== current + 1) {
      sequential = false;
      console.log(`\n⚠️  WARNING: Ports not sequential at index ${i}: ${current} → ${next}`);
      break;
    }
  }
  if (sequential) {
    console.log('✅ All ports are sequential');
  }
} else {
  console.log('\n⚠️  WARNING: No ports configured!');
}

console.log('\n=== Environment Variables ===');
console.log('DECODO_PROXY_ENABLED:', process.env.DECODO_PROXY_ENABLED || 'not set');
console.log('DECODO_PROXY_HOST:', process.env.DECODO_PROXY_HOST || 'not set');
console.log('DECODO_PROXY_PORT_START:', process.env.DECODO_PROXY_PORT_START || 'not set');
console.log('DECODO_PROXY_PORT_END:', process.env.DECODO_PROXY_PORT_END || 'not set');
console.log('DECODO_ROTATE_ON_RESTART:', process.env.DECODO_ROTATE_ON_RESTART || 'not set');

console.log('\n=== End Diagnostic ===\n');

