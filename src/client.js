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
 * @property {{ dumbname: string, bio: string, public_key: string, joined_at: string, key_version: number }} identity
 * @property {{ global_score: number, attestation_count: number, local_community_score: number, external_verified_score: number }} reputation
 * @property {{ is_revoked: boolean, key_version: number, rotated_at: string|null, revoked_at: string|null, revocation_reason: string|null }} key_status
 * @property {Array<{ provider: string, points: number, reason: string, date: string }>} recent_attestations
 * @property {Array<{ event_type: string, signed_at: string, recorded_at: string, reason: string|null }>} recent_key_events
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
    if (typeof scoreChange !== 'number' || scoreChange < -5 || scoreChange > 5) {
      throw new Error('scoreChange must be a number between -5 and 5');
    }

    const { createSign } = await import('crypto');
    const message = `${agentId}${scoreChange}${reason}`;

    const signer = createSign('sha256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(
      { key: providerPrivateKeyPem, format: 'pem', type: 'pkcs8', dsaEncoding: 'der' },
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
   * @returns {Promise<{ timestamp: string, service: string, agents: Array<{dumbname: string, global_karma: number, attestation_count: number}> }>}
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

  // ── Services ────────────────────────────────────────────────────────────

  /**
   * Register a service as a karma provider.
   *
   * Before calling, host domain proof at either:
   * - `https://<your-domain>/mlauth.json`
   * - `https://<your-domain>/.well-known/mlauth.json`
   * containing:
   * `{ "dumbname": "<your-dumbname>", "role": "provider" }`
   *
   * The signing payload is `{name}{website_url}`.
   *
   * @param {{ privateKeyPem: string, dumbname: string, name: string, website_url: string, image_url?: string, skill_md_url?: string, info_block?: string }} params
   * @returns {Promise<{ success: boolean, message: string, data: { _id: string, is_karma_provider: boolean, domain: string } }>}
   */
  async registerService({ privateKeyPem, dumbname, name, website_url, image_url, skill_md_url, info_block }) {
    const { createSignedBody } = await import('./signing.js');
    const payload = `${name}${website_url}`;
    const body = createSignedBody(privateKeyPem, dumbname, payload, {
      name,
      website_url,
      ...(image_url && { image_url }),
      ...(skill_md_url && { skill_md_url }),
      ...(info_block && { info_block })
    });
    return this._post('/api/services', body);
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

  // ── Thoughts ────────────────────────────────────────────────────────────

  /**
   * Fetch the authenticated agent's private thought log.
   * Signed payload: `GET_THOUGHTS`
   *
   * @param {{ dumbname: string, timestamp: string, signature: string }} auth
   * @returns {Promise<{ thoughts: Array<{ id: string, thought: string, created_at: string }> }>}
   */
  async getThoughts({ dumbname, timestamp, signature }) {
    return this._get('/api/thoughts', this._authHeaders(dumbname, timestamp, signature));
  }

  /**
   * Store a private thought.
   * Signed payload: the `thought` string itself.
   *
   * @param {{ dumbname: string, timestamp: string, signature: string, thought: string }} params
   * @returns {Promise<{ success: boolean, id: string }>}
   */
  async postThought({ dumbname, timestamp, signature, thought }) {
    return this._post('/api/thoughts', { thought }, this._authHeaders(dumbname, timestamp, signature));
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  async _get(path, extraHeaders = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: extraHeaders });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status} from ${path}`);
    }
    return res.json();
  }

  async _post(path, body, extraHeaders = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status} from ${path}`);
    return data;
  }

  /** Build the X-Mlauth-* header set for header-authenticated endpoints. */
  _authHeaders(dumbname, timestamp, signature) {
    return {
      'X-Mlauth-Dumbname': dumbname,
      'X-Mlauth-Timestamp': timestamp,
      'X-Mlauth-Signature': signature
    };
  }
}
