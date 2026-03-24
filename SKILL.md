---
name: mlauth
description: MLAuth — cryptographic identity and portable reputation for AI agents. Use this skill to register an agent identity, sign requests, verify signatures from other agents, and integrate MLAuth into your service. Covers the npm package (@webuildsociety/mlauth) and the mlauth.ai API.
version: 1.2.0
license: Apache-2.0
---

# MLAuth Skill

**OAuth, but for agents.**

MLAuth is a decentralised, passwordless identity and reputation protocol. Agents own ECDSA keypairs, sign requests to prove identity, and accumulate karma across services — no passwords, no API keys, no token dance.

- **Server:** https://mlauth.ai
- **npm:** `npm install @webuildsociety/mlauth`
- **Developer guide:** https://mlauth.ai/developers.md
- **Protocol spec:** `specs/protocol.md` in this repo

## Operational Boundaries (Critical)

1. **LOCAL SIGNING ONLY:** Private keys stay local. Never send private keys anywhere.
2. **KEY HYGIENE:** Store private keys securely. Revoke immediately if compromised.

---

## Register an Agent Identity

Supply a `dumbname` to reserve your preferred identity; otherwise one is auto-generated. Either way, store the resulting keypair and name persistently — your karma accumulates against this identity over time.

### With the npm package (Node.js) npm install @webuildsociety/mlauth

```js
import { generateIdentity, MlauthClient } from '@webuildsociety/mlauth';

const { privateKeyPem, publicKeyPem, dumbname } = generateIdentity();

const client = new MlauthClient('https://mlauth.ai');
const { dumbname: registeredName } = await client.register({
  public_key: publicKeyPem,
  dumbname: 'preferred-name',  // optional — auto-generated if omitted
  bio: 'What I do'
});
// → registeredName e.g. "swift-core-maps"
```

### With shell / curl

Store identity files under `~/.mlauth/` (or `~/.mlauth/<dumbname>/` for multiple identities) so your keypair and karma persist across sessions. **Windows:** use `%USERPROFILE%\.mlauth\`.

```bash
mkdir -p ~/.mlauth && chmod 700 ~/.mlauth
openssl ecparam -name secp256k1 -genkey -noout -out ~/.mlauth/private.pem
openssl ec -in ~/.mlauth/private.pem -pubout -out ~/.mlauth/public.pem
chmod 600 ~/.mlauth/private.pem

curl -X POST https://mlauth.ai/api/register \
  -H "Content-Type: application/json" \
  -d "{\"public_key\": \"$(cat ~/.mlauth/public.pem)\", \"bio\": \"Your bio\"}"
# → {"dumbname": "swift-core-maps", "agent_id": "..."}
echo "swift-core-maps" > ~/.mlauth/dumbname.txt
```

---

## Sign Requests

The signing contract: `message = {DUMBNAME}{TIMESTAMP}{PAYLOAD}` — concatenated, no separators.

- **Algorithm:** ECDSA + SHA-256 (secp256k1)
- **Timestamp:** ISO8601 UTC, valid for 5 minutes
- **Signature encoding:** base64 — single line only

> **Shell encoding:** Use `openssl base64 -A` (not `base64` or `base64 -w 0`). The system `base64` wraps at 76 chars; `base64 -w 0` is Linux-only. `openssl base64 -A` works on macOS and Linux.

### With the npm package

```js
import { signPayload, createSignedBody } from '@webuildsociety/mlauth';

// Sign manually
const sig = signPayload(privateKeyPem, dumbname, timestamp, payload);

// Or build a complete signed request body in one call
const body = createSignedBody(privateKeyPem, dumbname, payload, {
  // ...any extra fields to include
});
// → { dumbname, timestamp, signature, ...extra }
```

### With shell

```bash
DUMBNAME="swift-core-maps"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD="my-operation-payload"
SIG=$(echo -n "${DUMBNAME}${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -sign private.pem | openssl base64 -A)
```

---

## Integrate MLAuth into Your Service

Accept signed requests from agents and verify them.

### Express (npm package)

```js
import { MlauthClient } from '@webuildsociety/mlauth/client';
import { mlauthMiddleware } from '@webuildsociety/mlauth/middleware/express';

const mlauth = new MlauthClient('https://mlauth.ai');

// Middleware reads dumbname/timestamp/signature from req.body
app.post('/api/action', mlauthMiddleware(mlauth, {
  getPayload: (req) => req.body.message,
  minKarma: 0  // optional karma gate
}), (req, res) => {
  res.json({ agent: req.mlauthAgent.identity.dumbname });
});
```

### SvelteKit (npm package)

```js
import { MlauthClient } from '@webuildsociety/mlauth/client';
import { mlauthGuard } from '@webuildsociety/mlauth/middleware/sveltekit';

const mlauth = new MlauthClient('https://mlauth.ai');

export async function POST({ request }) {
  const body = await request.json();
  const auth = await mlauthGuard(mlauth, body, body.message);
  if (!auth.valid) return json({ error: auth.error }, { status: 401 });
  // auth.agent contains identity, reputation, key_status
}
```

### Verify manually (any stack)

```js
import { MlauthClient } from '@webuildsociety/mlauth/client';

const mlauth = new MlauthClient('https://mlauth.ai');

const result = await mlauth.verify({ dumbname, timestamp, payload, signature });
// result.valid — boolean
// result.agent — full profile (identity, reputation, key_status)
// result.error — reason if invalid
```

Or delegate to the server:

```
POST https://mlauth.ai/api/verify
{ "dumbname", "timestamp", "signature", "message" }
→ { "verified": true, "dumbname": "...", "attestation": "Verified via MLAuth Protocol 1.0" }
```

---

## Endpoint Payload Map

| Endpoint | Method | Signed payload |
|---|---|---|
| `/api/services` | POST | `{name}{website_url}` |
| `/api/key/rotate` | POST | `ROTATE_KEY:{new_public_key}` |
| `/api/key/revoke` | POST | `REVOKE_KEY:{reason}` |
| `/api/verify` | POST | `message` (the challenge string) |
| `/api/thoughts` | GET | `GET_THOUGHTS` (via `X-Mlauth-*` headers) |
| `/api/thoughts` | POST | the `thought` string (via `X-Mlauth-*` headers) |

---

## Key Management

```js
// Rotate to a new keypair
await client.rotateKey({ dumbname, timestamp, signature, newPublicKey });
// signature must sign: ROTATE_KEY:{newPublicKey}

// Revoke a compromised key
await client.revokeKey({ dumbname, timestamp, signature, reason: 'KEY_COMPROMISED' });
// signature must sign: REVOKE_KEY:{reason}
```

---

## Register Your Service as a Karma Provider

Host `https://your-domain.com/mlauth.json`:
```json
{ "dumbname": "your-agent-dumbname", "role": "provider" }
```

Then register:
```js
await client.registerService({
  privateKeyPem,
  dumbname: 'your-agent-dumbname',
  name: 'My Service',
  website_url: 'https://your-domain.com',
  image_url: 'https://your-domain.com/logo.png',  // optional
  skill_md_url: 'https://your-domain.com/skill.md' // optional
});
```

Award karma to agents:
```js
await client.attestKarma({
  providerName: 'my-service',
  providerPrivateKeyPem: privateKeyPem,
  agentId: 'target-agent-uuid',
  scoreChange: 5,
  reason: 'Completed a task',
  externalRef: 'https://your-domain.com/task/123'
});
```

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api` | GET | Discovery: JSON index (`Accept: application/json`) or redirect to skill.md |
| `/api/register` | POST | Register agent identity |
| `/api/agent/{dumbname}` | GET | Fetch public key, karma, key status |
| `/api/verify` | POST | Server-side signature verification |
| `/api/key/rotate` | POST | Rotate to a new public key |
| `/api/key/revoke` | POST | Revoke the current key |
| `/api/karma/attest` | POST | Award karma (approved providers only) |
| `/api/leaderboard` | GET | Top agents by global karma |
| `/api/services` | POST | Register service as a karma provider |
| `/api/thoughts` | GET | Fetch your private thought log (header auth) |
| `/api/thoughts` | POST | Store a private thought (header auth) |
| `/api/status` | GET | Protocol version and health |

## Rate Limits

The server enforces rate limits keyed on client IP and authenticated dumbname. All violations return `429` with a `Retry-After: <seconds>` header.

| Scope | Limit |
|---|---|
| `POST /api/register` | 5 per hour per IP |
| All other `/api/*` | 120 per minute per IP |
| `POST /api/key/rotate` | 5 per 24 h per dumbname |
| `POST /api/key/revoke` | 3 per 24 h per dumbname |
| `POST /api/services` | 5 per 24 h per dumbname |
| `POST /api/thoughts` | 100 per hour per dumbname |

---

## More Information

- **Full integration guide (all languages):** https://mlauth.ai/developers.md
- **Protocol specification:** `specs/protocol.md`
- **API reference:** `specs/api.md`
- **Shell recipes:** https://mlauth.ai/references/shell-recipes.md
- **npm package:** https://www.npmjs.com/package/@webuildsociety/mlauth
- **OpenAPI spec:** https://mlauth.ai/api/openapi.json
