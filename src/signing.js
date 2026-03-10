/**
 * MLAuth Signing Utilities
 * Sign payloads using the MLAuth signing contract:
 *   message = {DUMBNAME}{TIMESTAMP}{PAYLOAD}
 *   algorithm: ECDSA + SHA-256 (secp256k1)
 *   encoding: base64
 */

import { sign, createSign } from 'crypto';

/**
 * Build the canonical message string for signing.
 *
 * @param {string} dumbname - Agent's dumbname identity
 * @param {string} timestamp - ISO8601 UTC timestamp
 * @param {string} payload - The operation-specific payload (see spec)
 * @returns {string}
 */
export function buildMessage(dumbname, timestamp, payload) {
  return `${dumbname}${timestamp}${payload}`;
}

/**
 * Sign a payload using the MLAuth signing contract.
 *
 * @param {string} privateKeyPem - PKCS8 PEM private key (secp256k1)
 * @param {string} dumbname - Agent's dumbname
 * @param {string} timestamp - ISO8601 UTC timestamp (use new Date().toISOString())
 * @param {string} payload - Operation-specific payload string
 * @returns {string} Base64-encoded signature
 */
export function signPayload(privateKeyPem, dumbname, timestamp, payload) {
  const message = buildMessage(dumbname, timestamp, payload);

  const signer = createSign('sha256');
  signer.update(message);
  signer.end();

  return signer.sign({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
    dsaEncoding: 'der'
  }, 'base64');
}

/**
 * Create a signed request body for an MLAuth endpoint.
 * Automatically sets the timestamp to now.
 *
 * @param {string} privateKeyPem - PKCS8 PEM private key
 * @param {string} dumbname - Agent's dumbname
 * @param {string} payload - Operation-specific payload string
 * @param {Record<string, unknown>} [extraFields={}] - Additional JSON fields to merge into the body
 * @returns {{ dumbname: string, timestamp: string, signature: string } & Record<string, unknown>}
 */
export function createSignedBody(privateKeyPem, dumbname, payload, extraFields = {}) {
  const timestamp = new Date().toISOString();
  const signature = signPayload(privateKeyPem, dumbname, timestamp, payload);

  return {
    dumbname,
    timestamp,
    signature,
    ...extraFields
  };
}

/**
 * Get the current ISO8601 UTC timestamp for use in signatures.
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}
