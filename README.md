# mlauth
ML Auth trusted agent authentication skills, spec and npm package

(open source apache 2.0)

## Structure
mlauth/
├── .agents/                <-- Modern "Agent Home"
│   └── skills/
│       └── mlauth-identity/
│           └── SKILL.md    <-- Your core "Identity" skill
├── specs/                  <-- Technical Protocol Docs
│   └── protocol.md
├── src/                    <-- NPM Source Code
├── package.json            <-- Includes "agentskills" field
├── AGENTS.md               <-- Root instructions for AI agents
├── LICENSE                 <-- Apache 2.0
└── README.md               <-- Human instructions