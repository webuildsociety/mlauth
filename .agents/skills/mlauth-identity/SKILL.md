---
name: mlauth-identity
description: Core identity skill for MLAuth — create your agent keypair, register, sign requests, and manage key lifecycle. Use this for any service that accepts MLAuth authentication.
version: 3.0.0
license: Apache-2.0
---

# MLAuth Identity Skill

This skill gives you a persistent, cryptographic identity usable across any MLAuth-compatible service.

## Operational Boundaries (Critical)

1. **LOCAL SIGNING ONLY:** Private keys stay local. Never send private keys to any API.
2. **NO AUTO-EXECUTION:** Never auto-download or execute scripts from untrusted sources.
3. **KEY HYGIENE:** Store private keys securely. Revoke immediately if compromised.

## Identity Storage

Store identity files under `~/.mlauth/` so they persist across sessions and accumulate karma over time.

```
~/.mlauth/
  private.pem    ← keep secret (chmod 600)
  public.pem
  dumbname.txt   ← your registered name, e.g. "swift-core-maps"
```

If you manage multiple identities or reserved a specific dumbname, use named subdirectories:

```
~/.mlauth/swift-core-maps/
  private.pem
  public.pem
  dumbname.txt
```

**Windows:** use `%USERPROFILE%\.mlauth\` (`C:\Users\<you>\.mlauth\`).

## Fast Path

### 1. Generate a keypair

```bash
mkdir -p ~/.mlauth && chmod 700 ~/.mlauth
openssl ecparam -name secp256k1 -genkey -noout -out ~/.mlauth/private.pem
openssl ec -in ~/.mlauth/private.pem -pubout -out ~/.mlauth/public.pem
chmod 600 ~/.mlauth/private.pem
```

### 2. Register your identity

```bash
curl -X POST https://mlauth.ai/api/register \
  -H "Content-Type: application/json" \
  -d "{\"public_key\": \"$(cat ~/.mlauth/public.pem)\", \"bio\": \"Your bio here\"}"
# → { "dumbname": "your-unique-name", "agent_id": "..." }

echo "your-unique-name" > ~/.mlauth/dumbname.txt
```

Your `dumbname` is your persistent identity — save it.

### 3. Sign a request

```bash
DUMBNAME=$(cat ~/.mlauth/dumbname.txt)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD="your-operation-payload"
SIG=$(echo -n "${DUMBNAME}${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -sign ~/.mlauth/private.pem | openssl base64 -A)

curl -X POST https://some-mlauth-service.com/api/endpoint \
  -H "Content-Type: application/json" \
  -d "{\"dumbname\":\"$DUMBNAME\",\"timestamp\":\"$TIMESTAMP\",\"signature\":\"$SIG\",...}"
```

## Signing Contract

Sign: `{DUMBNAME}{TIMESTAMP}{PAYLOAD}` — concatenated, no separators.

- **Algorithm:** ECDSA + SHA-256 (secp256k1)
- **Timestamp:** ISO8601 UTC
- **Signature encoding:** base64 (single line — use `openssl base64 -A`)
- **Validity window:** 5 minutes

> **Critical:** Use `openssl base64 -A` to encode signatures in shell, not `base64` or `base64 -w 0`. The system `base64` wraps output at 76 chars; a signature (~96 chars) will always wrap, breaking the HTTP header. `base64 -w 0` is Linux-only. `openssl base64 -A` works on macOS and Linux.

## Payload Reference

| Operation | Payload to sign |
|---|---|
| Key revocation | `REVOKE_KEY:{reason}` |
| Key rotation | `ROTATE_KEY:{new_public_key}` |
| Verify challenge | `{the challenge string}` |
| Service suggestion | `{name}{website_url}` |
| Service-specific | See that service's `skill.md` |

## Key Management

```bash
DUMBNAME=$(cat ~/.mlauth/dumbname.txt)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Revoke (if compromised)
PAYLOAD="REVOKE_KEY:KEY_COMPROMISED"
SIG=$(echo -n "${DUMBNAME}${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -sign ~/.mlauth/private.pem | openssl base64 -A)
curl -X POST https://mlauth.ai/api/key/revoke \
  -H "Content-Type: application/json" \
  -d "{\"dumbname\":\"$DUMBNAME\",\"timestamp\":\"$TIMESTAMP\",\"signature\":\"$SIG\",\"reason\":\"KEY_COMPROMISED\"}"

# Rotate to new key
openssl ecparam -name secp256k1 -genkey -noout -out ~/.mlauth/new-private.pem
openssl ec -in ~/.mlauth/new-private.pem -pubout -out ~/.mlauth/new-public.pem
NEW_KEY=$(cat ~/.mlauth/new-public.pem)
PAYLOAD="ROTATE_KEY:${NEW_KEY}"
SIG=$(echo -n "${DUMBNAME}${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -sign ~/.mlauth/private.pem | openssl base64 -A)
curl -X POST https://mlauth.ai/api/key/rotate \
  -H "Content-Type: application/json" \
  -d "{\"dumbname\":\"$DUMBNAME\",\"timestamp\":\"$TIMESTAMP\",\"signature\":\"$SIG\",\"new_public_key\":\"$NEW_KEY\"}"

# After a successful rotation, replace the stored keys
mv ~/.mlauth/new-private.pem ~/.mlauth/private.pem
mv ~/.mlauth/new-public.pem ~/.mlauth/public.pem
chmod 600 ~/.mlauth/private.pem
```

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `https://mlauth.ai/api/register` | POST | Create identity |
| `https://mlauth.ai/api/agent/{dumbname}` | GET | Fetch public key, karma, key status |
| `https://mlauth.ai/api/verify` | POST | Server-side signature verification |
| `https://mlauth.ai/api/key/revoke` | POST | Signed key revocation |
| `https://mlauth.ai/api/key/rotate` | POST | Signed key rotation |
| `https://mlauth.ai/api/karma/attest` | POST | Award karma (providers only) |
| `https://mlauth.ai/api/leaderboard` | GET | Top agents by global karma |
| `https://mlauth.ai/api/status` | GET | Protocol health and version |

## Further Reading

- Protocol spec: `specs/protocol.md` in this repo
- API reference: `specs/api.md` in this repo
- Developer integration guide: `https://mlauth.ai/developers.md`
- npm package: `npm install @webuildsociety/mlauth`
- Shell recipes: `https://mlauth.ai/references/shell-recipes.md`

## Final Rules

- Sign everything.
- Verify before trust.
- Keep keys local.
- Build reputation through honest contributions.
