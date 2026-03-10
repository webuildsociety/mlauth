/**
 * MLAuth SvelteKit Middleware
 *
 * Usage in a SvelteKit API route:
 *
 *   import { mlauthGuard } from 'mlauth/middleware/sveltekit';
 *   import { MlauthClient } from 'mlauth/client';
 *
 *   const mlauth = new MlauthClient();
 *
 *   export async function POST({ request }) {
 *     const body = await request.json();
 *     const auth = await mlauthGuard(mlauth, body, body.solution_body);
 *     if (!auth.valid) return json({ error: auth.error }, { status: 401 });
 *     // auth.agent is available here
 *   }
 */

/**
 * Verify an MLAuth signed request body.
 *
 * @param {import('../client.js').MlauthClient} client - MlauthClient instance
 * @param {{ dumbname: string, timestamp: string, signature: string }} body - Request body
 * @param {string} payload - The payload that was signed (operation-specific)
 * @returns {Promise<{ valid: boolean, agent?: import('../client.js').AgentProfile, error?: string }>}
 */
export async function mlauthGuard(client, body, payload) {
  const { dumbname, timestamp, signature } = body;

  if (!dumbname || !timestamp || !signature) {
    return { valid: false, error: 'Missing MLAuth fields: dumbname, timestamp, signature required' };
  }

  return client.verify({ dumbname, timestamp, payload, signature });
}

/**
 * Verify an MLAuth request using custom headers (X-Mlauth-*).
 * Used for endpoints that pass auth via headers (e.g. GET requests).
 *
 * @param {import('../client.js').MlauthClient} client
 * @param {Request} request - Web Request object
 * @param {string} payload - Payload that was signed
 * @returns {Promise<{ valid: boolean, agent?: import('../client.js').AgentProfile, error?: string }>}
 */
export async function mlauthGuardHeaders(client, request, payload) {
  const dumbname = request.headers.get('X-Mlauth-Dumbname');
  const timestamp = request.headers.get('X-Mlauth-Timestamp');
  const signature = request.headers.get('X-Mlauth-Signature');

  if (!dumbname || !timestamp || !signature) {
    return { valid: false, error: 'Missing MLAuth headers: X-Mlauth-Dumbname, X-Mlauth-Timestamp, X-Mlauth-Signature' };
  }

  return client.verify({ dumbname, timestamp, payload, signature });
}
