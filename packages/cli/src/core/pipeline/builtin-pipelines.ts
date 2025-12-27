/**
 * 🔮 OMGBUILD Built-in Pipelines
 * Standard Big Tech development pipelines
 */

import { Pipeline } from './pipeline-engine';

// ============================================================================
// FEATURE DEVELOPMENT PIPELINE
// ============================================================================

export const FEATURE_PIPELINE: Pipeline = {
  name: 'feature',
  description: 'Complete feature development pipeline - from analysis to PR',
  version: '1.0.0',
  tags: ['development', 'feature', 'bigtech'],
  steps: [
    {
      id: 'analyze',
      name: 'Requirements Analysis',
      description: 'Analyze requirements, identify gaps, assess risks',
      skill: 'analyze',
      taskType: 'analyze',
      task: `Analyze the following feature request:
\${FEATURE_DESCRIPTION}

Provide:
1. Detailed requirements breakdown
2. Acceptance criteria
3. Technical considerations
4. Potential risks and mitigations
5. Dependencies on other systems`,
      outputs: ['requirements', 'risks'],
    },
    {
      id: 'design',
      name: 'Architecture Design',
      description: 'Design the solution architecture',
      skill: 'architect',
      taskType: 'analyze',
      task: `Based on the requirements analysis, design the architecture for:
\${FEATURE_DESCRIPTION}

Previous analysis:
\${previous.output}

Provide:
1. High-level architecture
2. Component design
3. API contracts
4. Database schema changes
5. Integration points`,
      dependsOn: ['analyze'],
      outputs: ['architecture', 'api_spec'],
    },
    {
      id: 'implement',
      name: 'Implementation',
      description: 'Generate the code implementation',
      skill: 'code',
      taskType: 'code',
      task: `Implement the feature based on the architecture:
\${FEATURE_DESCRIPTION}

Architecture:
\${previous.output}

Follow project conventions and generate production-ready code.`,
      dependsOn: ['design'],
      outputs: ['code_files'],
    },
    {
      id: 'test',
      name: 'Test Generation',
      description: 'Generate comprehensive tests',
      skill: 'test',
      taskType: 'test',
      task: `Generate comprehensive tests for the implemented feature:
\${FEATURE_DESCRIPTION}

Include:
1. Unit tests with high coverage
2. Integration tests
3. Edge case tests
4. Error handling tests`,
      dependsOn: ['implement'],
      outputs: ['test_files'],
    },
    {
      id: 'security',
      name: 'Security Review',
      description: 'Security vulnerability assessment',
      skill: 'security',
      taskType: 'review',
      task: `Perform security review on the implementation:

Check for:
1. OWASP Top 10 vulnerabilities
2. Input validation
3. Authentication/Authorization issues
4. Data exposure risks
5. Injection vulnerabilities`,
      dependsOn: ['implement'],
      outputs: ['security_report'],
    },
    {
      id: 'review',
      name: 'Code Review',
      description: 'Big Tech style code review',
      skill: 'review',
      taskType: 'review',
      task: `Perform code review with Big Tech standards:

Review for:
1. Code quality and readability
2. Performance considerations
3. Error handling
4. Documentation
5. Test coverage
6. Best practices`,
      dependsOn: ['implement', 'test', 'security'],
      gate: {
        enabled: true,
        message: 'Review the code review feedback. Continue?',
      },
      outputs: ['review_feedback'],
    },
    {
      id: 'docs',
      name: 'Documentation',
      description: 'Generate documentation',
      skill: 'docs',
      taskType: 'document',
      task: `Generate documentation for the feature:
\${FEATURE_DESCRIPTION}

Include:
1. Feature overview
2. API documentation
3. Usage examples
4. Configuration options`,
      dependsOn: ['review'],
      outputs: ['documentation'],
    },
    {
      id: 'complete',
      name: 'Complete',
      description: 'Finalize and create summary',
      taskType: 'analyze',
      task: `Create a summary of the completed feature development:
\${FEATURE_DESCRIPTION}

Summarize:
1. What was implemented
2. Test coverage
3. Security considerations
4. Documentation
5. Ready for PR checklist`,
      dependsOn: ['docs'],
    },
  ],
};

// ============================================================================
// BUGFIX PIPELINE
// ============================================================================

export const BUGFIX_PIPELINE: Pipeline = {
  name: 'bugfix',
  description: 'Systematic bug investigation and fix pipeline',
  version: '1.0.0',
  tags: ['development', 'bugfix', 'debugging'],
  steps: [
    {
      id: 'investigate',
      name: 'Bug Investigation',
      description: 'Investigate the bug and identify root cause',
      skill: 'analyze',
      taskType: 'debug',
      task: `Investigate the following bug:
\${BUG_DESCRIPTION}

Analyze:
1. Symptoms and reproduction steps
2. Potential root causes (5 Whys)
3. Affected code paths
4. Impact assessment`,
      outputs: ['root_cause', 'impact'],
    },
    {
      id: 'fix',
      name: 'Implement Fix',
      description: 'Implement the bug fix',
      skill: 'code',
      taskType: 'code',
      task: `Fix the bug based on investigation:
\${BUG_DESCRIPTION}

Root cause analysis:
\${previous.output}

Implement a fix that:
1. Addresses the root cause
2. Doesn't introduce regressions
3. Is minimal and focused`,
      dependsOn: ['investigate'],
      outputs: ['fix_files'],
    },
    {
      id: 'test-fix',
      name: 'Test Fix',
      description: 'Generate regression tests',
      skill: 'test',
      taskType: 'test',
      task: `Generate tests to verify the bug fix and prevent regression:
\${BUG_DESCRIPTION}

Include:
1. Test that would have caught the bug
2. Regression tests
3. Edge case tests`,
      dependsOn: ['fix'],
      outputs: ['test_files'],
    },
    {
      id: 'review-fix',
      name: 'Review Fix',
      description: 'Review the fix',
      skill: 'review',
      taskType: 'review',
      task: `Review the bug fix:

Verify:
1. Fix addresses root cause
2. No new issues introduced
3. Tests cover the bug scenario
4. Code quality maintained`,
      dependsOn: ['test-fix'],
      gate: {
        enabled: true,
        message: 'Review the bug fix. Approve?',
      },
    },
  ],
};

// ============================================================================
// CODE REVIEW PIPELINE
// ============================================================================

export const REVIEW_PIPELINE: Pipeline = {
  name: 'review',
  description: 'Comprehensive code review pipeline',
  version: '1.0.0',
  tags: ['review', 'quality', 'bigtech'],
  steps: [
    {
      id: 'static-analysis',
      name: 'Static Analysis',
      description: 'Run static code analysis',
      taskType: 'review',
      task: `Perform static analysis on the code:
\${FILES}

Check for:
1. Code smells
2. Complexity issues
3. Duplication
4. Potential bugs`,
      outputs: ['static_report'],
    },
    {
      id: 'security-scan',
      name: 'Security Scan',
      description: 'Security vulnerability scan',
      skill: 'security',
      taskType: 'review',
      task: `Scan code for security vulnerabilities:
\${FILES}

Check OWASP Top 10 and common vulnerabilities.`,
      outputs: ['security_report'],
    },
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Detailed code review',
      skill: 'review',
      taskType: 'review',
      task: `Perform detailed code review:
\${FILES}

Review for:
1. Design patterns and architecture
2. Code readability and maintainability
3. Error handling
4. Performance
5. Test coverage
6. Documentation`,
      dependsOn: ['static-analysis', 'security-scan'],
      outputs: ['review_comments'],
    },
    {
      id: 'summary',
      name: 'Review Summary',
      description: 'Generate review summary',
      taskType: 'document',
      task: `Generate a code review summary:

Static Analysis:
\${step.static-analysis.output}

Security:
\${step.security-scan.output}

Review:
\${step.code-review.output}

Provide:
1. Overall assessment (Approve/Request Changes/Comment)
2. Critical issues
3. Suggestions
4. Praise for good practices`,
      dependsOn: ['code-review'],
    },
  ],
};

// ============================================================================
// REFACTORING PIPELINE
// ============================================================================

export const REFACTOR_PIPELINE: Pipeline = {
  name: 'refactor',
  description: 'Safe code refactoring pipeline',
  version: '1.0.0',
  tags: ['refactoring', 'quality', 'cleanup'],
  steps: [
    {
      id: 'analyze-code',
      name: 'Analyze Code',
      description: 'Analyze code for refactoring opportunities',
      skill: 'analyze',
      taskType: 'analyze',
      task: `Analyze code for refactoring:
\${FILES}

Identify:
1. Code smells
2. Duplication
3. Complex methods
4. Poor naming
5. Design issues`,
      outputs: ['refactor_opportunities'],
    },
    {
      id: 'plan-refactor',
      name: 'Plan Refactoring',
      description: 'Create refactoring plan',
      skill: 'architect',
      taskType: 'analyze',
      task: `Create a safe refactoring plan:

Analysis:
\${previous.output}

Plan should:
1. Prioritize by impact and risk
2. Define small, safe steps
3. Ensure backward compatibility
4. Maintain test coverage`,
      dependsOn: ['analyze-code'],
      outputs: ['refactor_plan'],
    },
    {
      id: 'refactor',
      name: 'Apply Refactoring',
      description: 'Apply refactoring changes',
      skill: 'code',
      taskType: 'refactor',
      task: `Apply refactoring according to plan:

Plan:
\${previous.output}

Apply changes step by step, ensuring each change is atomic and testable.`,
      dependsOn: ['plan-refactor'],
      gate: {
        enabled: true,
        message: 'Review refactoring plan before applying. Continue?',
      },
      outputs: ['refactored_files'],
    },
    {
      id: 'verify',
      name: 'Verify Refactoring',
      description: 'Verify refactoring is safe',
      skill: 'test',
      taskType: 'test',
      task: `Verify the refactoring:

1. Ensure all existing tests pass
2. Check for behavioral changes
3. Verify performance hasn't degraded
4. Add tests for any new code paths`,
      dependsOn: ['refactor'],
    },
  ],
};

// ============================================================================
// TESTING PIPELINE
// ============================================================================

export const TESTING_PIPELINE: Pipeline = {
  name: 'testing',
  description: 'Comprehensive testing pipeline',
  version: '1.0.0',
  tags: ['testing', 'quality', 'coverage'],
  steps: [
    {
      id: 'unit-tests',
      name: 'Generate Unit Tests',
      description: 'Generate unit tests',
      skill: 'test',
      taskType: 'test',
      task: `Generate comprehensive unit tests for:
\${FILES}

Requirements:
1. High coverage (>90%)
2. Test edge cases
3. Test error conditions
4. Use mocks appropriately`,
      outputs: ['unit_test_files'],
    },
    {
      id: 'integration-tests',
      name: 'Generate Integration Tests',
      description: 'Generate integration tests',
      skill: 'test',
      taskType: 'test',
      task: `Generate integration tests for:
\${FILES}

Test:
1. Component interactions
2. API contracts
3. Database operations
4. External service integrations`,
      outputs: ['integration_test_files'],
    },
    {
      id: 'e2e-tests',
      name: 'Generate E2E Tests',
      description: 'Generate end-to-end tests',
      skill: 'test',
      taskType: 'test',
      task: `Generate E2E tests for critical user flows:
\${USER_FLOWS}

Cover:
1. Happy paths
2. Error scenarios
3. Edge cases`,
      condition: 'env.E2E_ENABLED == "true"',
      outputs: ['e2e_test_files'],
    },
    {
      id: 'coverage-report',
      name: 'Coverage Analysis',
      description: 'Analyze test coverage',
      taskType: 'analyze',
      task: `Analyze test coverage and identify gaps:

Unit tests: \${step.unit-tests.output}
Integration tests: \${step.integration-tests.output}

Identify:
1. Uncovered code paths
2. Critical paths needing more tests
3. Test quality assessment`,
      dependsOn: ['unit-tests', 'integration-tests'],
    },
  ],
};

// ============================================================================
// DOCUMENTATION PIPELINE
// ============================================================================

export const DOCS_PIPELINE: Pipeline = {
  name: 'docs',
  description: 'Documentation generation pipeline',
  version: '1.0.0',
  tags: ['documentation', 'readme', 'api'],
  steps: [
    {
      id: 'readme',
      name: 'Generate README',
      description: 'Generate project README',
      skill: 'docs',
      taskType: 'document',
      task: `Generate a comprehensive README for the project:

Include:
1. Project overview
2. Installation instructions
3. Quick start guide
4. Configuration options
5. Contributing guidelines`,
      outputs: ['README.md'],
    },
    {
      id: 'api-docs',
      name: 'Generate API Docs',
      description: 'Generate API documentation',
      skill: 'docs',
      taskType: 'document',
      task: `Generate API documentation:
\${API_FILES}

Include:
1. Endpoint descriptions
2. Request/response formats
3. Authentication
4. Examples
5. Error codes`,
      outputs: ['api_docs'],
    },
    {
      id: 'architecture-docs',
      name: 'Architecture Documentation',
      description: 'Generate architecture docs',
      skill: 'docs',
      taskType: 'document',
      task: `Generate architecture documentation:

Include:
1. System overview
2. Component diagram
3. Data flow
4. Technology stack
5. Deployment architecture`,
      outputs: ['architecture_docs'],
    },
  ],
};

// ============================================================================
// RELEASE PIPELINE
// ============================================================================

export const RELEASE_PIPELINE: Pipeline = {
  name: 'release',
  description: 'Release preparation pipeline',
  version: '1.0.0',
  tags: ['release', 'deployment', 'changelog'],
  steps: [
    {
      id: 'changelog',
      name: 'Generate Changelog',
      description: 'Generate release changelog',
      skill: 'docs',
      taskType: 'document',
      task: `Generate changelog for version \${VERSION}:

Based on commits since \${LAST_VERSION}, categorize:
1. Features
2. Bug fixes
3. Breaking changes
4. Improvements
5. Dependencies`,
      outputs: ['CHANGELOG.md'],
    },
    {
      id: 'release-notes',
      name: 'Release Notes',
      description: 'Generate release notes',
      skill: 'docs',
      taskType: 'document',
      task: `Generate release notes for version \${VERSION}:

Changelog:
\${previous.output}

Create user-friendly release notes highlighting:
1. Key features
2. Important fixes
3. Migration guide (if breaking changes)`,
      dependsOn: ['changelog'],
      outputs: ['release_notes'],
    },
    {
      id: 'version-bump',
      name: 'Version Bump',
      description: 'Bump version numbers',
      taskType: 'code',
      task: `Update version to \${VERSION} in:
1. package.json
2. Version constants
3. Documentation references`,
      dependsOn: ['release-notes'],
      gate: {
        enabled: true,
        message: 'Review changelog and release notes. Proceed with version bump?',
      },
    },
  ],
};

// ============================================================================
// PIPELINE REGISTRY
// ============================================================================

export const BUILTIN_PIPELINES: Record<string, Pipeline> = {
  feature: FEATURE_PIPELINE,
  bugfix: BUGFIX_PIPELINE,
  review: REVIEW_PIPELINE,
  refactor: REFACTOR_PIPELINE,
  testing: TESTING_PIPELINE,
  docs: DOCS_PIPELINE,
  release: RELEASE_PIPELINE,
};

/**
 * Get a built-in pipeline by name
 */
export function getBuiltinPipeline(name: string): Pipeline | undefined {
  return BUILTIN_PIPELINES[name];
}

/**
 * List all built-in pipelines
 */
export function listBuiltinPipelines(): Array<{ name: string; description: string; steps: number }> {
  return Object.values(BUILTIN_PIPELINES).map(p => ({
    name: p.name,
    description: p.description || '',
    steps: p.steps.length,
  }));
}
