/**
 * 🔮 OMGBUILD Init Command
 * Initialize .omgbuild/ directory with chosen template
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

// Templates available
const TEMPLATES = {
  minimal: 'Bare essentials - config, core skills, basic rules',
  webapp: 'Web application - frontend skills, testing, CI/CD',
  api: 'API service - backend skills, OpenAPI, database',
  enterprise: 'Full Big Tech setup - all skills, workflows, security',
};

export const initCommand = new Command('init')
  .description('Initialize .omgbuild/ in current directory')
  .argument('[template]', 'Template to use (minimal, webapp, api, enterprise)', 'minimal')
  .option('-f, --force', 'Overwrite existing .omgbuild directory')
  .option('-n, --name <name>', 'Project name')
  .option('--dry-run', 'Show what would be created without creating')
  .action(async (template: string, options: { force?: boolean; name?: string; dryRun?: boolean }) => {
    try {
      await runInit(template, options);
    } catch (error) {
      console.error('❌ Init failed:', (error as Error).message);
      process.exit(1);
    }
  });

async function runInit(
  template: string,
  options: { force?: boolean; name?: string; dryRun?: boolean }
) {
  const cwd = process.cwd();
  const omgbuildDir = path.join(cwd, '.omgbuild');
  const projectName = options.name || path.basename(cwd);

  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║                    OMGBUILD INIT                               ║
   ╚═══════════════════════════════════════════════════════════════╝
`);

  // Validate template
  if (!TEMPLATES[template as keyof typeof TEMPLATES]) {
    console.log('📋 Available templates:');
    Object.entries(TEMPLATES).forEach(([name, desc]) => {
      console.log(`   • ${name.padEnd(12)} - ${desc}`);
    });
    throw new Error(`Unknown template: ${template}`);
  }

  console.log(`   📁 Project:  ${projectName}`);
  console.log(`   📦 Template: ${template}`);
  console.log(`   📍 Location: ${omgbuildDir}`);
  console.log();

  // Check if .omgbuild exists
  if (await fs.pathExists(omgbuildDir)) {
    if (!options.force) {
      throw new Error('.omgbuild already exists. Use --force to overwrite.');
    }
    console.log('   ⚠️  Removing existing .omgbuild/...');
    if (!options.dryRun) {
      await fs.remove(omgbuildDir);
    }
  }

  if (options.dryRun) {
    console.log('   🔍 DRY RUN - showing what would be created:\n');
  }

  // Create directory structure
  await createOmgbuildStructure(omgbuildDir, template, projectName, options.dryRun);

  console.log(`
   ✅ OMGBUILD initialized successfully!

   Next steps:
   1. Review .omgbuild/config.yaml and customize settings
   2. Read .omgbuild/skills/ to understand available AI capabilities
   3. Start with: omgbuild workflow feature "your first feature"

   Your AI agents are ready to assist! 🤖
`);
}

async function createOmgbuildStructure(
  omgbuildDir: string,
  template: string,
  projectName: string,
  dryRun?: boolean
) {
  const structure: Record<string, string | null> = {};

  // === CONFIG.YAML ===
  structure['config.yaml'] = generateConfig(projectName, template);

  // === SKILLS ===
  structure['skills/analyze/SKILL.md'] = generateAnalyzeSkill();
  structure['skills/code/SKILL.md'] = generateCodeSkill();
  structure['skills/test/SKILL.md'] = generateTestSkill();

  if (template !== 'minimal') {
    structure['skills/architect/SKILL.md'] = generateArchitectSkill();
    structure['skills/review/SKILL.md'] = generateReviewSkill();
  }

  if (template === 'enterprise') {
    structure['skills/security/SKILL.md'] = generateSecuritySkill();
    structure['skills/docs/SKILL.md'] = generateDocsSkill();
    structure['skills/ux/SKILL.md'] = generateUXSkill();
  }

  // === WORKFLOWS ===
  structure['workflows/feature.yaml'] = generateFeatureWorkflow();
  structure['workflows/bugfix.yaml'] = generateBugfixWorkflow();

  if (template === 'enterprise') {
    structure['workflows/sprint.yaml'] = generateSprintWorkflow();
    structure['workflows/release.yaml'] = generateReleaseWorkflow();
  }

  // === RULES ===
  structure['rules/architecture.md'] = generateArchitectureRules();
  structure['rules/style.md'] = generateStyleRules();
  structure['rules/testing.md'] = generateTestingRules();

  if (template === 'enterprise') {
    structure['rules/security.md'] = generateSecurityRules();
    structure['rules/review.md'] = generateReviewRules();
  }

  // === TEMPLATES ===
  structure['templates/prd.md'] = generatePRDTemplate();
  structure['templates/rfc.md'] = generateRFCTemplate();
  structure['templates/adr.md'] = generateADRTemplate();

  // === MEMORY ===
  structure['memory/decisions/.gitkeep'] = '';
  structure['memory/patterns/.gitkeep'] = '';
  structure['memory/learnings/.gitkeep'] = '';

  // === GENERATED ===
  structure['generated/docs/.gitkeep'] = '';
  structure['generated/plans/.gitkeep'] = '';
  structure['generated/reports/.gitkeep'] = '';

  // === INTEGRATIONS ===
  structure['integrations/cursor.json'] = generateCursorIntegration(projectName);
  structure['integrations/claude-code.md'] = generateClaudeCodeIntegration(projectName);
  structure['integrations/github-actions.yaml'] = generateGitHubActionsIntegration();

  // === README ===
  structure['README.md'] = generateReadme(projectName, template);

  // === ROOT PROJECT FILES ===
  // These are created in the project root, not in .omgbuild/
  const projectRoot = path.dirname(omgbuildDir);
  const rootFiles: Record<string, string> = {
    'CLAUDE.md': generateClaudeMd(projectName),
    '.cursorrules': generateCursorRules(projectName),
  };

  // Create .omgbuild files
  for (const [relativePath, content] of Object.entries(structure)) {
    const fullPath = path.join(omgbuildDir, relativePath);

    if (dryRun) {
      console.log(`   📄 .omgbuild/${relativePath}`);
    } else {
      await fs.ensureDir(path.dirname(fullPath));
      if (content !== null) {
        await fs.writeFile(fullPath, content, 'utf-8');
      }
    }
  }

  // Create root project files
  for (const [filename, content] of Object.entries(rootFiles)) {
    const fullPath = path.join(projectRoot, filename);

    if (dryRun) {
      console.log(`   📄 ${filename}`);
    } else {
      await fs.writeFile(fullPath, content, 'utf-8');
    }
  }

  console.log(`\n   📊 Created ${Object.keys(structure).length + Object.keys(rootFiles).length} files\n`);
}

function generateClaudeMd(projectName: string): string {
  return `# CLAUDE.md - Project Instructions for Claude Code

## 🔮 OMGBUILD-Powered Project: ${projectName}

This project uses **OMGBUILD** - an AI-Native Software Development Operating System.

## Quick Reference

\`\`\`
.omgbuild/
├── config.yaml     # Project settings, AI model routing
├── skills/         # AI capabilities (analyze, code, test, etc.)
├── workflows/      # Development processes  
├── rules/          # Code standards and constraints
├── templates/      # Document templates (PRD, RFC, ADR)
├── memory/         # Project history and learnings
└── generated/      # AI-generated artifacts
\`\`\`

## How to Work on This Project

### Before Any Task
1. Read \`.omgbuild/config.yaml\` to understand project settings
2. Check relevant skill in \`.omgbuild/skills/[skill]/SKILL.md\`
3. Review applicable rules in \`.omgbuild/rules/\`

### When Implementing Features
Follow \`.omgbuild/workflows/feature.yaml\`:
1. Analyze → 2. Design → 3. Implement → 4. Test → 5. Review

### Skill-Specific Instructions

**For Requirements Analysis:**
- Read \`.omgbuild/skills/analyze/SKILL.md\`
- Output: analysis.yaml with requirements, risks, clarifications

**For Code Generation:**
- Read \`.omgbuild/skills/code/SKILL.md\`
- Follow \`.omgbuild/rules/style.md\`
- Follow \`.omgbuild/rules/architecture.md\`

**For Test Generation:**
- Read \`.omgbuild/skills/test/SKILL.md\`
- Follow \`.omgbuild/rules/testing.md\`
- Target: 80%+ coverage

## CLI Commands

\`\`\`bash
omgbuild status                           # Check project status
omgbuild skill list                       # List available skills
omgbuild workflow feature "description"   # Run feature workflow
omgbuild skill info [skill-name]          # Get skill details
\`\`\`

## Quality Gates

Before completing any task:
- [ ] All tests pass
- [ ] Coverage meets threshold
- [ ] No lint errors
- [ ] No security vulnerabilities
- [ ] Documentation updated

## Memory System

After significant decisions:
1. Create ADR in \`.omgbuild/memory/decisions/\`
2. Update patterns if applicable
3. Document learnings

---
*Think Omega. Build Omega. Be Omega.* 🔮
`;
}

function generateCursorRules(projectName: string): string {
  return `# OMGBUILD Project Rules for ${projectName}

You are an AI assistant working on a project powered by OMGBUILD.

## Before Any Task

1. Read \`.omgbuild/config.yaml\` for project settings
2. Check relevant skill in \`.omgbuild/skills/\`
3. Follow rules in \`.omgbuild/rules/\`
4. Review memory in \`.omgbuild/memory/\`

## When Writing Code

- Follow \`.omgbuild/skills/code/SKILL.md\`
- Adhere to \`.omgbuild/rules/style.md\`
- Follow \`.omgbuild/rules/architecture.md\`

## When Generating Tests

- Follow \`.omgbuild/skills/test/SKILL.md\`
- Adhere to \`.omgbuild/rules/testing.md\`
- Target coverage from config

## When Implementing Features

Follow \`.omgbuild/workflows/feature.yaml\`:
Analyze → Design → Implement → Test → Review

## Quality Standards

- Test coverage: Check config
- Zero lint errors
- Zero security vulnerabilities
- Follow all rules

## After Completing Work

- Save artifacts to \`.omgbuild/generated/\`
- Update memory with decisions
- Document learnings

---
*Powered by OMGBUILD* 🔮
`;
}

// ============================================================================
// GENERATORS
// ============================================================================

function generateConfig(projectName: string, template: string): string {
  return `# 🔮 OMGBUILD Configuration
# AI-Native Software Development Operating System

project:
  name: "${projectName}"
  type: "${template}"
  version: "0.1.0"
  description: "Project initialized with OMGBUILD"

# AI Model Configuration
ai:
  # Default model for general tasks
  default_model: "claude-sonnet-4-20250514"
  
  # Model routing - which model for which task
  routing:
    analyze: "claude-sonnet-4-20250514"      # Requirements analysis
    architect: "claude-sonnet-4-20250514"    # System design
    code: "claude-sonnet-4-20250514"         # Code generation
    test: "claude-sonnet-4-20250514"         # Test generation
    review: "claude-sonnet-4-20250514"       # Code review
    docs: "claude-haiku-4-5-20251001"        # Documentation (faster)
    
  # Fallback models if primary fails
  fallbacks:
    - "gpt-4o"
    - "gemini-1.5-pro"

# Skill Configuration
skills:
  enabled:
    - analyze
    - code
    - test
${template !== 'minimal' ? '    - architect\n    - review' : ''}
${template === 'enterprise' ? '    - security\n    - docs\n    - ux' : ''}

# Workflow Settings
workflows:
  default_branch: "main"
  feature_branch_prefix: "feature/"
  bugfix_branch_prefix: "bugfix/"
  require_review: ${template === 'enterprise'}
  require_tests: true
  auto_generate_docs: ${template !== 'minimal'}

# Quality Gates
gates:
  test_coverage_min: ${template === 'enterprise' ? '80' : '60'}
  lint_errors_max: 0
  security_vulnerabilities_max: 0
  
# Team Configuration (for multi-person projects)
team:
  roles:
    - name: "developer"
      can_approve: false
    - name: "reviewer"
      can_approve: true
    - name: "admin"
      can_approve: true
      can_configure: true

# Memory Settings
memory:
  enabled: true
  max_decisions: 1000
  max_patterns: 500
  retention_days: 365
`;
}

function generateAnalyzeSkill(): string {
  return `# 🔍 Analyze Skill

## Purpose
Analyze requirements, user stories, and problems to create clear, actionable specifications.

## When to Use
- Starting a new feature
- Clarifying ambiguous requirements  
- Breaking down complex problems
- Understanding user needs

## Capabilities
1. **Requirement Analysis** - Parse user stories into technical requirements
2. **Gap Detection** - Identify missing information and edge cases
3. **Scope Definition** - Define clear boundaries and out-of-scope items
4. **Dependency Mapping** - Identify dependencies on other systems/features
5. **Risk Assessment** - Highlight potential risks and unknowns

## Input Format
\`\`\`yaml
type: feature | bug | improvement
title: "Short description"
description: |
  Detailed description of what's needed
context:
  - Any relevant context
  - Links to related items
constraints:
  - Time constraints
  - Technical constraints
\`\`\`

## Output Format
\`\`\`yaml
analysis:
  summary: "One paragraph summary"
  
  requirements:
    functional:
      - REQ-001: "Requirement description"
    non_functional:
      - NFR-001: "Performance requirement"
      
  clarifications_needed:
    - Question that needs answering
    
  assumptions:
    - Assumption being made
    
  risks:
    - risk: "Description"
      mitigation: "How to address"
      
  dependencies:
    - system: "External system"
      type: "API | Data | Service"
      
  scope:
    in_scope:
      - What's included
    out_of_scope:
      - What's explicitly excluded
      
  estimated_complexity: low | medium | high | very_high
\`\`\`

## Prompts

### Initial Analysis
\`\`\`
You are a Senior Technical Analyst following Big Tech best practices.

Analyze the following requirement and produce a comprehensive analysis:

<requirement>
{input}
</requirement>

Apply these principles:
1. TELESCOPIC - Zoom out to understand the bigger picture
2. MICROSCOPIC - Drill down to specific details
3. INVERSION - What could go wrong?

Output in the specified YAML format.
\`\`\`

### Clarification Questions
\`\`\`
Based on the analysis, generate 3-5 critical clarification questions that would most reduce uncertainty and risk.

Focus on:
- Edge cases
- Error handling
- Scale requirements
- Security implications
- User experience expectations
\`\`\`

## Examples

### Example Input
\`\`\`yaml
type: feature
title: "User Authentication"
description: |
  Users should be able to log in to the application
  using email and password
\`\`\`

### Example Output
\`\`\`yaml
analysis:
  summary: "Implement email/password authentication with standard security practices"
  
  requirements:
    functional:
      - REQ-001: "User can register with email and password"
      - REQ-002: "User can log in with credentials"
      - REQ-003: "User can reset forgotten password"
      - REQ-004: "User can log out"
    non_functional:
      - NFR-001: "Passwords must be hashed with bcrypt (min 10 rounds)"
      - NFR-002: "Sessions expire after 24 hours of inactivity"
      - NFR-003: "Rate limit: max 5 failed login attempts per 15 minutes"
      
  clarifications_needed:
    - "Is social login (Google, GitHub) required now or future?"
    - "Is 2FA/MFA required?"
    - "What's the password policy (min length, complexity)?"
    
  assumptions:
    - "Email verification is required before account is active"
    - "Standard session-based auth (not JWT) is acceptable"
    
  risks:
    - risk: "Brute force attacks"
      mitigation: "Implement rate limiting and account lockout"
    - risk: "Session hijacking"
      mitigation: "Use secure, httpOnly cookies with CSRF protection"
      
  dependencies:
    - system: "Email service"
      type: "Service"
      
  scope:
    in_scope:
      - Email/password registration
      - Login/logout
      - Password reset
    out_of_scope:
      - Social login
      - 2FA/MFA
      - Admin user management
      
  estimated_complexity: medium
\`\`\`

## Integration Points
- **Input from**: User stories, PRDs, stakeholder requests
- **Output to**: Architect skill, Code skill, PRD template
`;
}

function generateCodeSkill(): string {
  return `# 💻 Code Skill

## Purpose
Generate high-quality, production-ready code following best practices and project conventions.

## When to Use
- Implementing new features
- Refactoring existing code
- Creating boilerplate/scaffolding
- Writing utilities and helpers

## Capabilities
1. **Code Generation** - Write new code from specifications
2. **Refactoring** - Improve existing code structure
3. **Pattern Application** - Apply design patterns appropriately
4. **Convention Adherence** - Follow project style and conventions
5. **Documentation** - Include inline docs and comments

## Principles (OMEGA)
1. **Ω1 Leverage** - Generate code that generates code when possible
2. **Ω2 Abstraction** - Solve the class of problems, not just the instance
3. **Ω5 Zero-Marginal-Cost** - Code should scale without linear cost increase
4. **Ω7 Aesthetics** - Code should be beautiful and a joy to read

## Input Format
\`\`\`yaml
task: "What to implement"
context:
  language: "typescript | python | etc"
  framework: "react | express | fastapi | etc"
  existing_patterns: |
    Reference to existing code patterns in project
requirements:
  - Specific requirement 1
  - Specific requirement 2
constraints:
  - Any limitations or restrictions
\`\`\`

## Output Format
\`\`\`yaml
implementation:
  files:
    - path: "src/path/to/file.ts"
      action: create | modify
      content: |
        // Full file content
      explanation: "Why this implementation"
      
  tests_needed:
    - "Test case description"
    
  dependencies_added:
    - package: "package-name"
      version: "^1.0.0"
      reason: "Why needed"
      
  migration_needed: true | false
  migration_steps:
    - "Step 1"
\`\`\`

## Quality Standards
- [ ] No TypeScript \`any\` types (use \`unknown\` if needed)
- [ ] All functions have JSDoc comments
- [ ] Error handling for all async operations
- [ ] No hardcoded values (use config/env)
- [ ] Follows single responsibility principle
- [ ] Max function length: 50 lines
- [ ] Max file length: 300 lines

## Prompts

### Code Generation
\`\`\`
You are a Senior Software Engineer at a Big Tech company.

Generate production-ready code for:
<task>
{task}
</task>

Context:
<context>
{context}
</context>

Follow these rules:
1. Write clean, readable code
2. Include comprehensive error handling
3. Add JSDoc/docstring comments
4. Follow SOLID principles
5. Make it testable

Output the complete implementation.
\`\`\`

### Code Review Prompt
\`\`\`
Review this code for:
1. Bugs and edge cases
2. Security vulnerabilities
3. Performance issues
4. Code style and conventions
5. Test coverage gaps

Provide specific, actionable feedback.
\`\`\`

## Integration Points
- **Input from**: Analyze skill, Architect skill
- **Output to**: Test skill, Review skill
`;
}

function generateTestSkill(): string {
  return `# 🧪 Test Skill

## Purpose
Generate comprehensive tests that ensure code quality and prevent regressions.

## When to Use
- After implementing new features
- Before refactoring
- When fixing bugs (test-first)
- For increasing coverage

## Capabilities
1. **Unit Tests** - Test individual functions/components
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test full user flows
4. **Edge Case Detection** - Identify and test edge cases
5. **Mock Generation** - Create appropriate test mocks

## Testing Philosophy
- **Test Behavior, Not Implementation** - Tests should survive refactoring
- **Arrange-Act-Assert** - Clear test structure
- **One Assertion Per Test** - When practical
- **Descriptive Names** - Tests as documentation

## Input Format
\`\`\`yaml
code_to_test: |
  // The code that needs tests
test_type: unit | integration | e2e
coverage_target: 80  # percentage
focus_areas:
  - Happy path
  - Error handling
  - Edge cases
\`\`\`

## Output Format
\`\`\`yaml
tests:
  files:
    - path: "src/path/to/file.test.ts"
      content: |
        // Test file content
        
  coverage_estimate: 85
  
  test_cases:
    - name: "should do X when Y"
      type: unit
      priority: high
      
  mocks_needed:
    - name: "mockDatabase"
      purpose: "Isolate from real DB"
      
  setup_instructions:
    - "Any special setup needed"
\`\`\`

## Test Patterns

### Unit Test Template
\`\`\`typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = {};
      
      // Act
      const result = methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
  });
});
\`\`\`

### Edge Cases to Consider
- Empty inputs
- Null/undefined values
- Maximum/minimum values
- Invalid types
- Concurrent access
- Network failures
- Timeout scenarios

## Prompts

### Test Generation
\`\`\`
You are a Senior QA Engineer specializing in test automation.

Generate comprehensive tests for:
<code>
{code}
</code>

Requirements:
1. Cover happy path
2. Cover error cases
3. Cover edge cases
4. Use descriptive test names
5. Follow AAA pattern

Target coverage: {coverage_target}%
\`\`\`

## Integration Points
- **Input from**: Code skill
- **Output to**: CI/CD pipeline, Review skill
`;
}

function generateArchitectSkill(): string {
  return `# 🏗️ Architect Skill

## Purpose
Design scalable, maintainable system architectures following Big Tech patterns.

## When to Use
- Starting new projects/services
- Major feature additions
- System refactoring
- Technical debt resolution

## Capabilities
1. **System Design** - Create high-level architecture
2. **Component Design** - Define service boundaries
3. **Data Modeling** - Design database schemas
4. **API Design** - Define interfaces and contracts
5. **Trade-off Analysis** - Evaluate architectural options

## Design Principles
- **SOLID** - Single responsibility, Open-closed, etc.
- **DRY** - Don't repeat yourself
- **KISS** - Keep it simple, stupid
- **YAGNI** - You aren't gonna need it
- **Separation of Concerns** - Clear boundaries

## Output: Architecture Decision Record (ADR)
\`\`\`markdown
# ADR-XXX: [Title]

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing?

## Consequences
What becomes easier or more difficult because of this change?

## Alternatives Considered
What other options were evaluated?
\`\`\`

## Integration Points
- **Input from**: Analyze skill
- **Output to**: Code skill, Documentation
`;
}

function generateReviewSkill(): string {
  return `# 👀 Review Skill

## Purpose
Perform thorough code reviews following Big Tech standards.

## Review Checklist
- [ ] **Correctness** - Does it work as intended?
- [ ] **Security** - Any vulnerabilities?
- [ ] **Performance** - Any bottlenecks?
- [ ] **Maintainability** - Is it readable and maintainable?
- [ ] **Testing** - Adequate test coverage?
- [ ] **Documentation** - Clear comments and docs?

## Review Output
\`\`\`yaml
review:
  summary: "Overall assessment"
  
  issues:
    - severity: critical | major | minor | suggestion
      location: "file:line"
      issue: "Description"
      suggestion: "How to fix"
      
  approvals:
    - "What's done well"
    
  verdict: approve | request_changes | comment
\`\`\`
`;
}

function generateSecuritySkill(): string {
  return `# 🔒 Security Skill

## Purpose
Identify and prevent security vulnerabilities.

## Security Checklist
- [ ] Input validation
- [ ] Output encoding
- [ ] Authentication
- [ ] Authorization
- [ ] Data protection
- [ ] Secure communication
- [ ] Error handling
- [ ] Logging

## OWASP Top 10 Coverage
1. Injection
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting
8. Insecure Deserialization
9. Vulnerable Components
10. Insufficient Logging
`;
}

function generateDocsSkill(): string {
  return `# 📚 Documentation Skill

## Purpose
Generate clear, comprehensive documentation.

## Documentation Types
1. **API Documentation** - OpenAPI/Swagger specs
2. **Code Documentation** - Inline comments, JSDoc
3. **User Documentation** - How-to guides
4. **Architecture Documentation** - System design docs
5. **Runbooks** - Operational procedures
`;
}

function generateUXSkill(): string {
  return `# 🎨 UX Skill

## Purpose
Ensure excellent user experience in all interfaces.

## UX Principles
1. **Clarity** - Clear and understandable
2. **Efficiency** - Minimal steps to complete tasks
3. **Consistency** - Predictable behavior
4. **Feedback** - Clear response to actions
5. **Accessibility** - Usable by everyone
`;
}

function generateFeatureWorkflow(): string {
  return `# Feature Development Workflow

name: feature
description: "End-to-end workflow for developing new features"
version: "1.0.0"

triggers:
  - command: "omgbuild workflow feature"
  - command: "omg feature"

stages:
  - id: analyze
    name: "📋 Analyze Requirements"
    skill: analyze
    inputs:
      - name: title
        prompt: "Feature title"
        required: true
      - name: description
        prompt: "Describe the feature"
        required: true
    outputs:
      - analysis.yaml
      - clarifications.md
    gate:
      type: human_review
      message: "Review analysis before proceeding"

  - id: design
    name: "🏗️ Design Solution"
    skill: architect
    depends_on: [analyze]
    inputs:
      - from_stage: analyze
        artifact: analysis.yaml
    outputs:
      - design.md
      - adr.md
    gate:
      type: human_review
      message: "Review design before implementation"

  - id: implement
    name: "💻 Implement"
    skill: code
    depends_on: [design]
    inputs:
      - from_stage: design
        artifact: design.md
    outputs:
      - code_changes/
    parallel: true

  - id: test
    name: "🧪 Test"
    skill: test
    depends_on: [implement]
    inputs:
      - from_stage: implement
        artifact: code_changes/
    outputs:
      - tests/
      - coverage_report.md
    gate:
      type: auto
      condition: "coverage >= 80%"

  - id: review
    name: "👀 Code Review"
    skill: review
    depends_on: [test]
    inputs:
      - from_stage: implement
        artifact: code_changes/
      - from_stage: test
        artifact: tests/
    outputs:
      - review_report.md
    gate:
      type: human_review
      message: "Approve code changes"

  - id: complete
    name: "✅ Complete"
    type: completion
    depends_on: [review]
    actions:
      - create_pr
      - update_memory
      - notify

artifacts:
  location: ".omgbuild/generated/features/{feature_id}/"
  
memory:
  store_decision: true
  store_patterns: true
`;
}

function generateBugfixWorkflow(): string {
  return `# Bugfix Workflow

name: bugfix
description: "Workflow for fixing bugs"
version: "1.0.0"

triggers:
  - command: "omgbuild workflow bugfix"

stages:
  - id: reproduce
    name: "🔍 Reproduce & Analyze"
    skill: analyze
    
  - id: fix
    name: "🔧 Implement Fix"
    skill: code
    depends_on: [reproduce]
    
  - id: test
    name: "🧪 Test Fix"
    skill: test
    depends_on: [fix]
    
  - id: review
    name: "👀 Review"
    skill: review
    depends_on: [test]
`;
}

function generateSprintWorkflow(): string {
  return `# Sprint Workflow

name: sprint
description: "Sprint planning and execution"
version: "1.0.0"

stages:
  - id: plan
    name: "📋 Sprint Planning"
    
  - id: execute
    name: "🚀 Sprint Execution"
    
  - id: review
    name: "👀 Sprint Review"
    
  - id: retro
    name: "🔄 Retrospective"
`;
}

function generateReleaseWorkflow(): string {
  return `# Release Workflow

name: release
description: "Release preparation and deployment"
version: "1.0.0"

stages:
  - id: prepare
    name: "📦 Prepare Release"
    
  - id: test
    name: "🧪 Release Testing"
    
  - id: deploy
    name: "🚀 Deploy"
    
  - id: verify
    name: "✅ Verify"
`;
}

function generateArchitectureRules(): string {
  return `# Architecture Rules

## Core Principles
1. **Separation of Concerns** - Each module has one clear responsibility
2. **Dependency Direction** - Dependencies point inward (Clean Architecture)
3. **Interface Segregation** - Clients shouldn't depend on interfaces they don't use

## Layer Structure
\`\`\`
├── presentation/    # UI, API endpoints
├── application/     # Use cases, business logic
├── domain/          # Entities, value objects
└── infrastructure/  # Database, external services
\`\`\`

## Rules
- No circular dependencies
- Domain layer has no external dependencies
- Infrastructure implements interfaces defined in application layer
`;
}

function generateStyleRules(): string {
  return `# Code Style Rules

## General
- Use meaningful variable names
- Maximum line length: 100 characters
- Use 2 spaces for indentation (JS/TS) or 4 spaces (Python)

## TypeScript Specific
- No \`any\` type (use \`unknown\` if needed)
- Use interfaces over types for object shapes
- Use const assertions where appropriate

## Functions
- Maximum 50 lines per function
- Maximum 4 parameters (use object for more)
- Single responsibility

## Files
- Maximum 300 lines per file
- One component/class per file
- Group related files in directories
`;
}

function generateTestingRules(): string {
  return `# Testing Rules

## Coverage Requirements
- Minimum 80% line coverage
- 100% coverage for critical paths

## Test Types Required
- Unit tests for all business logic
- Integration tests for APIs
- E2E tests for critical user flows

## Naming Convention
\`\`\`
should [expected behavior] when [condition]
\`\`\`

## Test Structure
\`\`\`
Arrange - Set up test data
Act - Execute the code
Assert - Verify the result
\`\`\`
`;
}

function generateSecurityRules(): string {
  return `# Security Rules

## Authentication
- Use industry-standard protocols (OAuth 2.0, OpenID Connect)
- Enforce strong password policies
- Implement rate limiting

## Data Protection
- Encrypt sensitive data at rest and in transit
- Never log sensitive information
- Use parameterized queries (no SQL injection)

## Input Validation
- Validate all inputs on the server side
- Sanitize outputs to prevent XSS
- Use allowlists over denylists
`;
}

function generateReviewRules(): string {
  return `# Code Review Rules

## Required for Approval
- All tests passing
- No security vulnerabilities
- Follows style guide
- Adequate documentation

## Review Focus Areas
1. Correctness
2. Security
3. Performance
4. Maintainability
5. Testing
`;
}

function generatePRDTemplate(): string {
  return `# Product Requirements Document (PRD)

## Overview
| Field | Value |
|-------|-------|
| Feature | [Name] |
| Author | [Name] |
| Status | Draft / In Review / Approved |
| Created | [Date] |

## Problem Statement
[What problem are we solving? Who has this problem?]

## Goals
- [ ] Goal 1
- [ ] Goal 2

## Non-Goals
- Non-goal 1

## User Stories
As a [user type], I want to [action] so that [benefit].

## Requirements

### Functional Requirements
- FR-1: [Requirement]

### Non-Functional Requirements
- NFR-1: [Requirement]

## Design
[Link to design docs or embed diagrams]

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| | | |

## Timeline
| Milestone | Date |
|-----------|------|
| | |

## Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |
`;
}

function generateRFCTemplate(): string {
  return `# RFC: [Title]

## Summary
[One paragraph summary]

## Motivation
[Why is this needed?]

## Detailed Design
[Technical details of the proposal]

## Drawbacks
[Why should we NOT do this?]

## Alternatives
[What other approaches were considered?]

## Unresolved Questions
[What needs to be resolved before implementation?]
`;
}

function generateADRTemplate(): string {
  return `# ADR-XXX: [Title]

## Status
Proposed | Accepted | Deprecated | Superseded by [ADR-XXX]

## Context
[What is the issue that we're seeing that is motivating this decision or change?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences
[What becomes easier or more difficult to do because of this change?]
`;
}

function generateCursorIntegration(projectName: string): string {
  return JSON.stringify({
    name: projectName,
    description: "OMGBUILD-powered project",
    rules: [
      "Always read .omgbuild/skills/ before implementing features",
      "Follow .omgbuild/rules/ for code style and architecture",
      "Generate tests according to .omgbuild/rules/testing.md",
      "Update .omgbuild/memory/ with important decisions"
    ],
    context: {
      include: [
        ".omgbuild/**/*.md",
        ".omgbuild/**/*.yaml"
      ]
    }
  }, null, 2);
}

function generateClaudeCodeIntegration(projectName: string): string {
  return `# Claude Code Integration for ${projectName}

## Project Context
This project uses OMGBUILD - an AI-Native Software Development Operating System.

## Important Directories
- \`.omgbuild/skills/\` - AI capabilities and how to use them
- \`.omgbuild/workflows/\` - Development processes
- \`.omgbuild/rules/\` - Code standards and constraints
- \`.omgbuild/memory/\` - Project history and decisions

## Before Implementing
1. Read relevant skill files in \`.omgbuild/skills/\`
2. Check rules in \`.omgbuild/rules/\`
3. Review past decisions in \`.omgbuild/memory/\`

## After Implementing
1. Generate tests following \`.omgbuild/rules/testing.md\`
2. Document decisions in \`.omgbuild/memory/decisions/\`
3. Update patterns in \`.omgbuild/memory/patterns/\` if applicable

## Commands
\`\`\`bash
omgbuild workflow feature "description"  # Start new feature
omgbuild workflow bugfix "description"   # Fix a bug
omgbuild skill run analyze              # Run analysis skill
omgbuild status                         # Check project status
\`\`\`
`;
}

function generateGitHubActionsIntegration(): string {
  return `# OMGBUILD GitHub Actions Integration

name: OMGBUILD CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Lint
        run: npm run lint
        
      - name: Test
        run: npm test
        
      - name: Build
        run: npm run build
`;
}

function generateReadme(projectName: string, template: string): string {
  return `# 🔮 .omgbuild - ${projectName}

This directory contains the OMGBUILD configuration for AI-native software development.

## What is OMGBUILD?

OMGBUILD is an AI-Native Software Development Operating System that brings Big Tech engineering practices to your project through AI agents.

## Directory Structure

\`\`\`
.omgbuild/
├── config.yaml          # Project configuration
├── skills/              # AI capabilities
│   ├── analyze/         # Requirements analysis
│   ├── code/            # Code generation
│   └── test/            # Test generation
├── workflows/           # Development processes
├── rules/               # Code standards
├── templates/           # Document templates
├── memory/              # Project history
├── generated/           # AI-generated artifacts
└── integrations/        # IDE & CI/CD configs
\`\`\`

## Quick Commands

\`\`\`bash
# Start a new feature
omgbuild workflow feature "Add user authentication"

# Run analysis on requirements
omgbuild skill run analyze

# Check project status
omgbuild status
\`\`\`

## Template Used: ${template}

${template === 'minimal' ? 'Basic setup with core skills only.' : ''}
${template === 'webapp' ? 'Web application setup with frontend skills.' : ''}
${template === 'api' ? 'API service setup with backend skills.' : ''}
${template === 'enterprise' ? 'Full Big Tech setup with all skills and workflows.' : ''}

## Learn More

- Documentation: https://omgbuild.dev/docs
- GitHub: https://github.com/omgbuild/omgbuild
`;
}
