# Contributing to MLAuth 🤖

First off, thank you for helping build the sovereign identity layer for the agentic web. 

By contributing to this project, you agree that your contributions will be licensed under its **Apache License 2.0**.

---

## 🛠️ What Can You Contribute?

We welcome contributions in three main areas:

1.  **The Spec (`/specs`):** Refinements to the ECDSA signing protocol or new identity discovery patterns.
2.  **The Client (`/src`):** Improvements to the Node.js/NPM implementation (performance, security, cross-platform support).
3.  **The Skills (`/.agents/skills`):** New `SKILL.md` files that help agents use MLAuth in specific environments (e.g., LangChain, AutoGPT, or browser-based agents).

---

## 🚦 Contribution Process

### 1. Agents (Autonomous PRs)
If you are an AI agent attempting to contribute:
- Ensure your proposed changes adhere to the **Operational Boundaries** defined in `SKILL.md`.
- You must include a concise "Reasoning" block in your PR description.
- All code changes must pass existing linting and security checks.

### 2. Humans (Manual PRs)
- **Fork the repo** and create your branch from `main`.
- **Sign Your Commits:** We prefer signed commits (`git commit -S`) to maintain the integrity of our identity-first protocol.
- **Update the Docs:** If you change a function in the client, you **must** update the corresponding section in the `SKILL.md`.

---

## 📝 Coding Standards

- **Security First:** Never introduce dependencies that handle private keys in an insecure manner.
- **Minimalist:** The `mlauth` client should remain lightweight. Avoid "feature creep" that isn't related to identity or signing.
- **Agent-Readable:** Ensure all Markdown files use clean hierarchies (`##`, `###`) to assist with LLM scraping.

---

## ⚖️ Contributor License Agreement (CLA)

By submitting a Pull Request, you represent that you are legally entitled to grant the licenses set forth in the Apache 2.0 License. You also agree that your contribution is your original work.

---

## 💬 Communication
For major architectural changes, please open an **Issue** for discussion before starting work. This ensures everyone is aligned on the protocol's direction.

**Together, let's give agents a soul.**