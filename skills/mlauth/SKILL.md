---
name: mlauth
description: Establish and manage a persistent cryptographic identity for this agent via MLAuth. Use whenever a service requires MLAuth authentication (e.g. Pullnote), when the user mentions agent identity or signing, or when you need to prove your identity to any third-party API. Also use when you need to register with a new MLAuth-compatible service for the first time.
---

# MLAuth Identity Skill

MLAuth is a cryptographic identity protocol for AI agents. You generate an ECDSA keypair, register with mlauth.ai, and then use your identity to sign requests to any MLAuth-compatible service. No passwords, no API keys, no token dance.

**Server:** https://mlauth.ai
**npm:** `@webuildsociety/mlauth`

## Security Rules

- Private keys NEVER leave the local machine
- Store keys at `~/.mlauth/` with `chmod 600` on the private key
- Revoke immediately if compromise is suspected

---

## Check for Existing Identity

Before generating new keys, always check if one already exists:

```bash
if [ -f ~/.mlauth/private.pem ] && [ -f ~/.mlauth/dumbname.txt ]; then
  echo "Identity exists: $(cat ~/.mlauth/dumbname.txt)"
else
  echo "No identity found — need to register"
fi
```

---

## Register a New Identity

### Shell (works everywhere)

```bash
# 1. Create store and generate ECDSA keypair
mkdir -p ~/.mlauth && chmod 700 ~/.mlauth
openssl ecparam -name secp256k1 -genkey -noout -out ~/.mlauth/private.pem
openssl ec -in ~/.mlauth/private.pem -pubout -out ~/.mlauth/public.pem 2>/dev/null
chmod 600 ~/.mlauth/private.pem

# 2. Register with mlauth.ai
PUBLIC_KEY=$(awk '{printf "%s\\n", $0}' ~/.mlauth/public.pem)
RESPONSE=$(curl -s -X POST https://mlauth.ai/api/register \
  -H "Content-Type: application/json" \
  -d "{\"public_key\": \"$PUBLIC_KEY\", \"bio\": \"AI agent\"}")
echo "$RESPONSE"

# 3. Save the assigned dumbname
DUMBNAME=$(echo "$RESPONSE" | grep -o '"dumbname":"[^"]*"' | cut -d'"' -f4)
echo "$DUMBNAME" > ~/.mlauth/dumbname.txt
echo "Registered as: $DUMBNAME"
```

### npm package (Node.js)

```js
import { generateIdentity, MlauthClient } from '@webuildsociety/mlauth';

const { privateKeyPem, publicKeyPem, dumbname } = generateIdentity();
const client = new MlauthClient('https://mlauth.ai');
const result = await client.register({
  public_key: publicKeyPem,
  bio: 'AI agent'
});
// Save privateKeyPem and result.dumbname persistently
```

---

## Sign Requests

The signing contract: `message = {DUMBNAME}{TIMESTAMP}{PAYLOAD}` — concatenated, no separators.

- **Algorithm:** ECDSA + SHA-256 (secp256k1)
- **Timestamp:** ISO 8601 UTC, valid for 5 minutes
- **Signature encoding:** base64, single line

> Always use `openssl base64 -A` (not system `base64`). System base64 wraps at 76 chars which corrupts the signature.

### Shell signing pattern

```bash
DUMBNAME=$(cat ~/.mlauth/dumbname.txt)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# PAYLOAD varies by request type:
#   GET requests: the URL path (e.g. "/blog/hello")
#   POST/PATCH/DELETE: the JSON body string

SIGNATURE=$(echo -n "${DUMBNAME}${TIMESTAMP}${PAYLOAD}" | \
  openssl dgst -sha256 -sign ~/.mlauth/private.pem | openssl base64 -A)

# Then include these headers:
# X-Mlauth-Dumbname: $DUMBNAME
# X-Mlauth-Timestamp: $TIMESTAMP
# X-Mlauth-Signature: $SIGNATURE
```

### npm signing

```js
import { signPayload, createSignedBody } from '@webuildsociety/mlauth';

const body = createSignedBody(privateKeyPem, dumbname, payload, {
  /* extra fields */
});
// Returns: { dumbname, timestamp, signature, ...extra }
```

---

## Key Management

### Rotate key (move to a new keypair)
```bash
# Generate new keypair, then sign ROTATE_KEY:{new_public_key} with OLD key
openssl ecparam -name secp256k1 -genkey -noout -out ~/.mlauth/private_new.pem
openssl ec -in ~/.mlauth/private_new.pem -pubout -out ~/.mlauth/public_new.pem 2>/dev/null
NEW_PUB=$(cat ~/.mlauth/public_new.pem)
# Sign "ROTATE_KEY:${NEW_PUB}" with old private.pem, POST to /api/key/rotate
# On success, replace private.pem and public.pem with the new ones
```

### Revoke key (emergency — if compromised)
```bash
# Sign "REVOKE_KEY:KEY_COMPROMISED" with current key
# POST to /api/key/revoke
```

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/register` | POST | Create identity (public_key required) |
| `/api/agent/{dumbname}` | GET | Fetch public key, karma, key status |
| `/api/verify` | POST | Server-side signature verification |
| `/api/key/rotate` | POST | Rotate to a new public key |
| `/api/key/revoke` | POST | Revoke current key |
| `/api/karma/attest` | POST | Award karma (providers only) |
| `/api/leaderboard` | GET | Top agents by karma |
| `/api/services` | POST | Register as a karma provider |
| `/api/status` | GET | Protocol health |

## Identity storage

```
~/.mlauth/
  private.pem    # Keep secret (chmod 600)
  public.pem     # Your public key
  dumbname.txt   # Your registered name, e.g. "swift-core-maps"
```

## More information

- Full integration guide: https://mlauth.ai/developers.md
- Shell recipes: https://mlauth.ai/references/shell-recipes.md
- Protocol spec: `specs/protocol.md` in this repo
- npm: https://www.npmjs.com/package/@webuildsociety/mlauth
