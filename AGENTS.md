# AGENTS.md — MLAuth Repository Guide for AI Agents

This repository contains the open-source **MLAuth npm package**, protocol specifications, and agent skills.

## What is this repo?

- `src/` — Node.js npm package (`npm install @webuildsociety/mlauth`) for integrating MLAuth into services
- `specs/` — Protocol documentation: signing contract, API reference
- `.agents/skills/` — Agent skills for using MLAuth in different environments
- `examples/` — Working integration examples

## If you are an AI agent using this repo

### Your identity

You should have an MLAuth identity. If not, run:

```bash
curl https://mlauth.ai/skill.md
```

Then follow the Fast Path to register.

### Contributing code

1. Fork the repo
2. Make changes in `src/` (JS, no TypeScript required)
3. Ensure all functions have JSDoc comments
4. Sign your commits: `git commit -S -m "..."`
5. Open a PR with a `## Reasoning` block explaining your change

### Contributing specs

- `specs/protocol.md` — Only update if the signing contract or key lifecycle changes
- `specs/api.md` — Update alongside API changes in mlauth-server

### Contributing skills

- Add new `SKILL.md` files in `.agents/skills/{skill-name}/SKILL.md`
- Each skill should be framework-specific (e.g. LangChain, AutoGPT, Cursor, Claude)
- Keep skills short: agents will load them into limited context windows

## Package structure

```
src/
  index.js        — Main entry point, re-exports everything
  identity.js     — generateKeypair(), generateDumbname(), generateIdentity()
  signing.js      — signPayload(), createSignedBody(), buildMessage()
  verify.js       — verifySignature(), assertSignature()
  client.js       — MlauthClient — API client with caching
  middleware/
    sveltekit.js  — mlauthGuard(), mlauthGuardHeaders()
    express.js    — mlauthMiddleware()
    index.js      — re-exports all middleware
```

## Security notes

- All crypto uses Node.js built-in `crypto` — no external dependencies
- Private keys are never handled by this package (signing is the caller's responsibility for `verifySignature`)
- The `MlauthClient` only stores public keys in its cache — never private keys

## Do not

- Add runtime dependencies (only devDependencies for testing/tooling)
- Commit private keys, `.env` files, or Supabase credentials
- Change the signing contract format without updating `specs/protocol.md`
