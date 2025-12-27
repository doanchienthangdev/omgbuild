# 🔮 OMGBUILD

> **AI-Native Software Development Operating System**
> 
> *"Big Tech Engineering Culture in a Box"*

[![npm version](https://img.shields.io/npm/v/omgbuild.svg)](https://www.npmjs.com/package/omgbuild)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is OMGBUILD?

OMGBUILD transforms any empty folder into a **self-orchestrating software factory** by encoding Big Tech engineering practices into AI-executable format.

```
INPUT:  Empty folder + `npx omgbuild init`
OUTPUT: Self-managing software factory with Big Tech processes
```

### The Problem

Small teams can't achieve Big Tech quality because:
- They lack specialists for every role (architect, security, QA, DevOps)
- Best practices exist as tribal knowledge, not executable specs
- AI coding tools are powerful but unstructured

### The Solution

OMGBUILD creates a `.omgbuild/` directory that acts as the **"DNA"** of your project:
- **Skills** - AI capabilities that know how to analyze, code, test, review
- **Workflows** - Step-by-step processes for features, bugfixes, releases
- **Rules** - Code standards, architecture constraints, security requirements
- **Memory** - Project history that AI agents learn from

AI agents (Claude Code, Cursor, etc.) read this directory and know exactly how to work on your project.

---

## Quick Start

```bash
# Initialize OMGBUILD in your project
npx omgbuild init

# Or with a specific template
npx omgbuild init webapp
npx omgbuild init api
npx omgbuild init enterprise
```

This creates a `.omgbuild/` directory with everything your AI agents need.

---

## Usage

### With Claude Code

```bash
# Start a new feature
claude "Read .omgbuild/skills/analyze/SKILL.md and analyze this requirement: Add user authentication"

# Generate code
claude "Follow .omgbuild/skills/code/SKILL.md to implement the login feature"

# Run a workflow
claude "Execute the feature workflow from .omgbuild/workflows/feature.yaml for: Add user dashboard"
```

### With Cursor / Windsurf / Other IDEs

Open your AI assistant and reference the skills:

```
You are working on a project with OMGBUILD.
Read .omgbuild/config.yaml for project settings.
Follow the skills in .omgbuild/skills/ for how to approach tasks.
Adhere to rules in .omgbuild/rules/ for code standards.
```

### CLI Commands

```bash
# Show project status
omgbuild status

# List available skills
omgbuild skill list

# Get skill details
omgbuild skill info analyze

# Run a workflow
omgbuild workflow feature "Add user authentication"

# Invoke an agent
omgbuild agent analyze "Parse this user story"
```

---

## Directory Structure

After running `omgbuild init`, you'll have:

```
.omgbuild/
├── config.yaml          # Project configuration
├── skills/              # AI capabilities
│   ├── analyze/         # Requirements analysis
│   │   └── SKILL.md
│   ├── code/            # Code generation
│   │   └── SKILL.md
│   └── test/            # Test generation
│       └── SKILL.md
├── workflows/           # Development processes
│   ├── feature.yaml     # New feature workflow
│   └── bugfix.yaml      # Bug fix workflow
├── rules/               # Code standards
│   ├── architecture.md
│   ├── style.md
│   └── testing.md
├── templates/           # Document templates
│   ├── prd.md
│   ├── rfc.md
│   └── adr.md
├── memory/              # Project history
│   ├── decisions/
│   ├── patterns/
│   └── learnings/
├── generated/           # AI-generated artifacts
│   ├── docs/
│   ├── plans/
│   └── reports/
└── integrations/        # IDE & CI/CD configs
    ├── cursor.json
    ├── claude-code.md
    └── github-actions.yaml
```

---

## Templates

| Template | Description |
|----------|-------------|
| `minimal` | Bare essentials - core skills, basic rules |
| `webapp` | Web application - frontend skills, testing, CI/CD |
| `api` | API service - backend skills, OpenAPI, database |
| `enterprise` | Full Big Tech setup - all skills, workflows, security |

```bash
omgbuild init enterprise  # Get everything
```

---

## Skills

Skills are AI capabilities defined in markdown format. Each skill tells AI agents:
- **Purpose** - What this skill does
- **Capabilities** - What it can achieve
- **Input/Output Format** - How to use it
- **Prompts** - Ready-to-use prompts
- **Examples** - Sample inputs and outputs

### Core Skills

| Skill | Description |
|-------|-------------|
| `analyze` | Requirements analysis, gap detection, risk assessment |
| `code` | Code generation following project conventions |
| `test` | Comprehensive test generation |
| `architect` | System design and architecture decisions |
| `review` | Code review with Big Tech standards |
| `security` | Security vulnerability detection |
| `docs` | Documentation generation |

---

## Workflows

Workflows are multi-stage processes that orchestrate skills:

```yaml
# .omgbuild/workflows/feature.yaml
stages:
  - id: analyze
    name: "📋 Analyze Requirements"
    skill: analyze
    
  - id: design
    name: "🏗️ Design Solution"
    skill: architect
    depends_on: [analyze]
    
  - id: implement
    name: "💻 Implement"
    skill: code
    depends_on: [design]
    
  - id: test
    name: "🧪 Test"
    skill: test
    depends_on: [implement]
```

---

## Memory System

OMGBUILD remembers your project history:

- **Decisions** - Architecture decisions with rationale
- **Patterns** - Discovered patterns that work
- **Learnings** - What to avoid, what works

This creates a learning system that improves over time.

---

## Philosophy

OMGBUILD is built on the **OMEGA Framework**:

| Principle | Application |
|-----------|-------------|
| **Ω1 Leverage** | AI agents do the work, humans direct |
| **Ω2 Abstraction** | Skills solve classes of problems |
| **Ω3 Decomposition** | Complex tasks = orchestrated agents |
| **Ω4 Feedback** | Rapid iteration with AI assistance |
| **Ω5 Scaling** | Zero marginal cost per feature |
| **Ω6 Emergence** | System learns and improves |
| **Ω7 Aesthetics** | World-class output quality |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT © OMEGA

---

<p align="center">
  <b>Think Omega. Build Omega. Be Omega.</b> 🔮
</p>
