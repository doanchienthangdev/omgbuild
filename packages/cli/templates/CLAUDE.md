# CLAUDE.md - Project Instructions for Claude Code

## 🔮 OMGBUILD-Powered Project

This project uses **OMGBUILD** - an AI-Native Software Development Operating System that encodes Big Tech engineering practices into AI-executable format.

## Quick Reference

```bash
# Project structure
.omgbuild/
├── config.yaml     # 📋 Project settings, AI model routing
├── skills/         # 🧠 AI capabilities (analyze, code, test, etc.)
├── workflows/      # 🔄 Development processes  
├── rules/          # 📏 Code standards and constraints
├── templates/      # 📝 Document templates (PRD, RFC, ADR)
├── memory/         # 🧠 Project history and learnings
└── generated/      # 📦 AI-generated artifacts
```

## How to Work on This Project

### Before Any Task
1. Read `.omgbuild/config.yaml` to understand project settings
2. Check relevant skill in `.omgbuild/skills/[skill]/SKILL.md`
3. Review applicable rules in `.omgbuild/rules/`

### When Implementing Features
```bash
# Follow the feature workflow:
# 1. Analyze → 2. Design → 3. Implement → 4. Test → 5. Review

# Read the workflow definition:
cat .omgbuild/workflows/feature.yaml
```

### Skill-Specific Instructions

**For Requirements Analysis:**
```
Read .omgbuild/skills/analyze/SKILL.md
Output: analysis.yaml with requirements, risks, clarifications needed
```

**For Code Generation:**
```
Read .omgbuild/skills/code/SKILL.md
Follow .omgbuild/rules/style.md
Follow .omgbuild/rules/architecture.md
```

**For Test Generation:**
```
Read .omgbuild/skills/test/SKILL.md
Follow .omgbuild/rules/testing.md
Target: 80%+ coverage
```

## CLI Commands

```bash
# Check project status
omgbuild status

# List available skills
omgbuild skill list

# Run a workflow
omgbuild workflow feature "description"

# Get skill details
omgbuild skill info [skill-name]
```

## Quality Gates

Before completing any task, ensure:
- [ ] All tests pass
- [ ] Coverage meets threshold (check config)
- [ ] No lint errors
- [ ] No security vulnerabilities
- [ ] Follows style guide
- [ ] Documentation updated

## Memory System

After significant decisions:
1. Create ADR in `.omgbuild/memory/decisions/`
2. Update patterns if applicable
3. Document learnings

## Available Skills

| Skill | Purpose | File |
|-------|---------|------|
| analyze | Requirements analysis | `.omgbuild/skills/analyze/SKILL.md` |
| code | Code generation | `.omgbuild/skills/code/SKILL.md` |
| test | Test generation | `.omgbuild/skills/test/SKILL.md` |
| architect | System design | `.omgbuild/skills/architect/SKILL.md` |
| review | Code review | `.omgbuild/skills/review/SKILL.md` |
| security | Security audit | `.omgbuild/skills/security/SKILL.md` |
| docs | Documentation | `.omgbuild/skills/docs/SKILL.md` |

---

*Think Omega. Build Omega. Be Omega.* 🔮
