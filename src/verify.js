/**
 * MLAuth Verification Utilities
 * Verify agent signatures locally without any network calls.
 * Use this when you have the agent's public key already.
 * To fetch the public key, use MlauthClient.getAgent() or cache it yourself.
 */

import { createVerify } from 'crypto';
import { buildMessage } from './signing.js';

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify an MLAuth signature locally.
 *
 * @param {string} publicKeyPem - SPKI PEM public key (secp256k1)
 * @param {string} dumbname - Agent's claimed dumbname
 * @param {string} timestamp - ISO8601 timestamp from the request
 * @param {string} payload - Operation-specific payload string
 * @param {string} signature - Base64-encoded signature from the request
 * @returns {{ valid: boolean, error?: string }}
 */
export function verifySignature(publicKeyPem, dumbname, timestamp, payload, signature) {
  // 1. Check timestamp freshness
  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format — must be ISO8601 UTC' };
  }

  const drift = Math.abs(Date.now() - requestTime);
  if (drift > TIMESTAMP_WINDOW_MS) {
    return { valid: false, error: 'Signature expired — timestamp outside 5-minute window' };
  }

  // 2. Reconstruct the signed message
  const message = buildMessage(dumbname, timestamp, payload);

  // 3. Cryptographic verification
  try {
    const verifier = createVerify('sha256');
    verifier.update(message);
    verifier.end();

    const isValid = verifier.verify(
      { key: publicKeyPem, format: 'pem', type: 'spki', dsaEncoding: 'der' },
      Buffer.from(signature, 'base64')
    );

    if (!isValid) {
      return { valid: false, error: 'Signature verification failed' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Verification error: ${err.message}` };
  }
}

/**
 * Strict version — throws on failure instead of returning an error object.
 *
 * @param {string} publicKeyPem
 * @param {string} dumbname
 * @param {string} timestamp
 * @param {string} payload
 * @param {string} signature
 * @throws {Error} if signature is invalid or expired
 */
export function assertSignature(publicKeyPem, dumbname, timestamp, payload, signature) {
  const result = verifySignature(publicKeyPem, dumbname, timestamp, payload, signature);
  if (!result.valid) {
    throw new Error(result.error);
  }
}
