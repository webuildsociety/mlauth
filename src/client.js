/**
 * MLAuth API Client
 * Communicates with an mlauth-server instance (default: https://mlauth.ai).
 * Caches public keys with a configurable TTL to minimise network calls.
 */

import { verifySignature } from './verify.js';

const DEFAULT_BASE_URL = 'https://mlauth.ai';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * @typedef {Object} AgentProfile
 * @property {{ dumbname: string, bio: string, public_key: string, key_version: number }} identity
 * @property {{ global_score: number }} reputation
 * @property {{ is_revoked: boolean, key_version: number, rotated_at: string|null, revoked_at: string|null }} key_status
 */

export class MlauthClient {
  /**
   * @param {string} [baseUrl] - Base URL of the mlauth-server (default: https://mlauth.ai)
   * @param {{ cacheTtlMs?: number }} [options]
   */
  constructor(baseUrl = DEFAULT_BASE_URL, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    /** @type {Map<string, { data: AgentProfile, fetchedAt: number }>} */
    this._cache = new Map();
  }

  // ── Identity ────────────────────────────────────────────────────────────

  /**
   * Register a new agent.
   *
   * @param {{ public_key: string, dumbname?: string, bio?: string }} params
   * @returns {Promise<{ success: boolean, dumbname: string, agent_id: string }>}
   */
  async register({ public_key, dumbname, bio = '' }) {
    const res = await this._post('/api/register', { public_key, dumbname, bio });
    return res;
  }

  /**
   * Fetch an agent's full profile (identity, reputation, key status).
   * Results are cached for `cacheTtlMs` milliseconds.
   *
   * @param {string} dumbname
   * @returns {Promise<AgentProfile>}
   */
  async getAgent(dumbname) {
    const cached = this._cache.get(dumbname);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.data;
    }

    const data = await this._get(`/api/agent/${encodeURIComponent(dumbname)}`);
    this._cache.set(dumbname, { data, fetchedAt: Date.now() });
    return data;
  }

  /**
   * Invalidate the cached profile for an agent (e.g. after key rotation).
   * @param {string} dumbname
   */
  invalidateCache(dumbname) {
    this._cache.delete(dumbname);
  }

  // ── Verification ────────────────────────────────────────────────────────

  /**
   * Verify an agent signature locally using the cached public key.
   * Fetches the public key from mlauth-server if not cached.
   * Returns false if the key is revoked.
   *
   * @param {{ dumbname: string, timestamp: string, payload: string, signature: string }} params
   * @returns {Promise<{ valid: boolean, agent?: AgentProfile, error?: string }>}
   */
  async verify({ dumbname, timestamp, payload, signature }) {
    let agent;
    try {
      agent = await this.getAgent(dumbname);
    } catch (err) {
      return { valid: false, error: `Agent not found: ${err.message}` };
    }

    if (agent.key_status?.is_revoked) {
      return { valid: false, error: 'Agent key is revoked' };
    }

    const result = verifySignature(
      agent.identity.public_key,
      dumbname,
      timestamp,
      payload,
      signature
    );

    if (!result.valid) return { valid: false, error: result.error };
    return { valid: true, agent };
  }

  /**
   * Proxy verification to the mlauth-server (simpler but adds network latency).
   * Use `verify()` instead for production where possible.
   *
   * @param {{ dumbname: string, timestamp: string, signature: string, message: string }} params
   * @returns {Promise<{ verified: boolean, dumbname: string, attestation?: string, error?: string }>}
   */
  async verifyRemote({ dumbname, timestamp, signature, message }) {
    return this._post('/api/verify', { dumbname, timestamp, signature, message });
  }

  // ── Karma ───────────────────────────────────────────────────────────────

  /**
   * Submit a karma attestation (requires provider keypair).
   * Signs the attestation with the provider's private key.
   *
   * @param {{ providerName: string, providerPrivateKeyPem: string, agentId: string, scoreChange: number, reason: string, externalRef?: string }} params
   */
  async attestKarma({ providerName, providerPrivateKeyPem, agentId, scoreChange, reason, externalRef }) {
    const { createSign } = await import('crypto');
    const message = `${agentId}${scoreChange}${reason}`;

    const signer = createSign('sha256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(
      { key: providerPrivateKeyPem, format: 'pem', type: 'pkcs8' },
      'base64'
    );

    return this._post('/api/karma/attest', {
      provider_name: providerName,
      agent_id: agentId,
      score_change: scoreChange,
      reason,
      external_ref: externalRef,
      signature
    });
  }

  /**
   * Get the leaderboard.
   * @param {number} [limit=100]
   * @returns {Promise<{ agents: Array<{dumbname: string, global_karma: number}> }>}
   */
  async getLeaderboard(limit = 100) {
    return this._get(`/api/leaderboard?limit=${limit}`);
  }

  /**
   * Get service health and protocol metadata.
   */
  async getStatus() {
    return this._get('/api/status');
  }

  // ── Key Management ──────────────────────────────────────────────────────

  /**
   * Rotate to a new public key.
   *
   * @param {{ dumbname: string, timestamp: string, signature: string, newPublicKey: string }} params
   */
  async rotateKey({ dumbname, timestamp, signature, newPublicKey }) {
    this.invalidateCache(dumbname);
    return this._post('/api/key/rotate', {
      dumbname, timestamp, signature, new_public_key: newPublicKey
    });
  }

  /**
   * Revoke the current key.
   *
   * @param {{ dumbname: string, timestamp: string, signature: string, reason?: string }} params
   */
  async revokeKey({ dumbname, timestamp, signature, reason = 'KEY_COMPROMISED' }) {
    this.invalidateCache(dumbname);
    return this._post('/api/key/revoke', { dumbname, timestamp, signature, reason });
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  async _get(path) {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status} from ${path}`);
    }
    return res.json();
  }

  async _post(path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status} from ${path}`);
    return data;
  }
}
