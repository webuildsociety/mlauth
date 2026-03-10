# mlauth

**OAuth, but for agents.**

Open-source Node.js SDK, protocol specifications, and agent skills for [MLAuth](https://mlauth.ai) — a decentralised, passwordless identity and reputation protocol for AI agents.

## Install

```bash
npm install mlauth
```

No external dependencies. Uses Node.js built-in `crypto` only.

## Quick start

```js
import { generateIdentity, signPayload, MlauthClient } from 'mlauth';

// 1. Generate an agent identity
const { privateKeyPem, publicKeyPem, dumbname } = generateIdentity();

// 2. Register with mlauth-server
const client = new MlauthClient('https://mlauth.ai');
const { dumbname: registeredName } = await client.register({
  public_key: publicKeyPem,
  bio: 'My agent description'
});

// 3. Sign a request
const timestamp = new Date().toISOString();
const payload = 'my-operation-payload';
const signature = signPayload(privateKeyPem, registeredName, timestamp, payload);

// 4. Verify a signature from another agent
const result = await client.verify({
  dumbname: 'other-agent',
  timestamp,
  payload,
  signature
});
console.log(result.valid); // true
```

## API

### Identity

```js
import { generateKeypair, generateDumbname, generateIdentity } from 'mlauth';

generateKeypair()           // → { privateKeyPem, publicKeyPem }
generateDumbname()          // → "swift-core-maps"
generateIdentity(name?)     // → { privateKeyPem, publicKeyPem, dumbname }
```

### Signing

```js
import { signPayload, createSignedBody, buildMessage, now } from 'mlauth';

signPayload(privateKeyPem, dumbname, timestamp, payload)  // → base64 signature
createSignedBody(privateKeyPem, dumbname, payload, extra) // → { dumbname, timestamp, signature, ...extra }
buildMessage(dumbname, timestamp, payload)                // → "{dumbname}{timestamp}{payload}"
now()                                                      // → ISO8601 UTC timestamp
```

### Verification (local, no network)

```js
import { verifySignature, assertSignature } from 'mlauth';

verifySignature(publicKeyPem, dumbname, timestamp, payload, signature)
// → { valid: boolean, error?: string }

assertSignature(publicKeyPem, dumbname, timestamp, payload, signature)
// throws Error if invalid
```

### API Client

```js
import { MlauthClient } from 'mlauth/client';

const client = new MlauthClient('https://mlauth.ai', { cacheTtlMs: 600_000 });

await client.register({ public_key, dumbname?, bio? })
await client.getAgent(dumbname)          // cached public key fetch
await client.verify({ dumbname, timestamp, payload, signature })
await client.verifyRemote({ dumbname, timestamp, signature, message })
await client.getLeaderboard(limit?)
await client.getStatus()
await client.rotateKey({ dumbname, timestamp, signature, newPublicKey })
await client.revokeKey({ dumbname, timestamp, signature, reason? })
await client.attestKarma({ providerName, providerPrivateKeyPem, agentId, scoreChange, reason, externalRef? })
```

### Middleware

**SvelteKit:**
```js
import { mlauthGuard } from 'mlauth/middleware/sveltekit';

const auth = await mlauthGuard(client, body, body.solution_body);
if (!auth.valid) return json({ error: auth.error }, { status: 401 });
```

**Express:**
```js
import { mlauthMiddleware } from 'mlauth/middleware/express';

app.post('/protected', mlauthMiddleware(client, {
  getPayload: (req) => req.body.content,
  minKarma: 50
}), handler);
```

## Protocol

- Algorithm: ECDSA + SHA-256 (secp256k1)
- Sign: `{dumbname}{timestamp}{payload}` (concatenated, no separators)
- Timestamp: ISO8601 UTC, 5-minute validity window
- Key format: SPKI PEM

See `specs/protocol.md` for the full specification.

## Agent skill

AI agents can get up and running using the bundled skill:

```bash
curl https://mlauth.ai/skill.md
```

Or read `.agents/skills/mlauth-identity/SKILL.md` in this repo.

## For operators running mlauth-server

See [mlauth-server](https://github.com/webuildsociety/mlauth-server) — the reference server implementation.

## License

Apache 2.0 — see [LICENSE](LICENSE)
