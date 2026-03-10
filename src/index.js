/**
 * mlauth — OAuth, but for agents.
 *
 * Main entry point. Re-exports all public API surface.
 *
 * @example
 * import { generateIdentity, signPayload, verifySignature, MlauthClient } from 'mlauth';
 */

// Identity generation
export { generateKeypair, generateDumbname, generateIdentity } from './identity.js';

// Signing
export { signPayload, createSignedBody, buildMessage, now } from './signing.js';

// Verification
export { verifySignature, assertSignature } from './verify.js';

// API client
export { MlauthClient } from './client.js';
