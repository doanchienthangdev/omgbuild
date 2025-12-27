/**
 * 🔮 OMGBUILD CI/CD Generator
 * Auto-generate CI/CD pipelines for various platforms
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export type CICDPlatform = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'jenkins';

export interface CICDConfig {
  platform: CICDPlatform;
  projectType: 'node' | 'python' | 'go' | 'rust' | 'java' | 'dotnet' | 'generic';
  features: {
    lint: boolean;
    test: boolean;
    build: boolean;
    security: boolean;
    deploy: boolean;
    docker: boolean;
  };
  branches: {
    main: string;
    develop?: string;
  };
  environments?: {
    staging?: boolean;
    production?: boolean;
  };
  notifications?: {
    slack?: string;
    email?: string;
  };
}

// ============================================================================
// CI/CD GENERATOR
// ============================================================================

export class CICDGenerator {
  private omgbuildDir: string;
  private projectRoot: string;

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.projectRoot = path.dirname(omgbuildDir);
  }

  /**
   * Detect project type from files
   */
  async detectProjectType(): Promise<CICDConfig['projectType']> {
    const files = await fs.readdir(this.projectRoot);

    if (files.includes('package.json')) return 'node';
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'python';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
    if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) return 'dotnet';

    return 'generic';
  }

  /**
   * Generate CI/CD configuration
   */
  async generate(config: Partial<CICDConfig> = {}): Promise<string> {
    const projectType = config.projectType || await this.detectProjectType();
    
    const fullConfig: CICDConfig = {
      platform: config.platform || 'github',
      projectType,
      features: {
        lint: config.features?.lint ?? true,
        test: config.features?.test ?? true,
        build: config.features?.build ?? true,
        security: config.features?.security ?? true,
        deploy: config.features?.deploy ?? false,
        docker: config.features?.docker ?? false,
      },
      branches: {
        main: config.branches?.main || 'main',
        develop: config.branches?.develop,
      },
      environments: config.environments,
      notifications: config.notifications,
    };

    switch (fullConfig.platform) {
      case 'github':
        return this.generateGitHubActions(fullConfig);
      case 'gitlab':
        return this.generateGitLabCI(fullConfig);
      case 'bitbucket':
        return this.generateBitbucketPipelines(fullConfig);
      default:
        return this.generateGitHubActions(fullConfig);
    }
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGitHubActions(config: CICDConfig): string {
    const workflow: Record<string, unknown> = {
      name: 'OMGBUILD CI/CD',
      on: {
        push: {
          branches: [config.branches.main, config.branches.develop].filter(Boolean),
        },
        pull_request: {
          branches: [config.branches.main],
        },
      },
      env: this.getEnvironmentVariables(config),
      jobs: {},
    };

    // Lint job
    if (config.features.lint) {
      (workflow.jobs as Record<string, unknown>).lint = this.getGitHubLintJob(config);
    }

    // Test job
    if (config.features.test) {
      (workflow.jobs as Record<string, unknown>).test = this.getGitHubTestJob(config);
    }

    // Security scan job
    if (config.features.security) {
      (workflow.jobs as Record<string, unknown>).security = this.getGitHubSecurityJob(config);
    }

    // Build job
    if (config.features.build) {
      (workflow.jobs as Record<string, unknown>).build = this.getGitHubBuildJob(config);
    }

    // Docker job
    if (config.features.docker) {
      (workflow.jobs as Record<string, unknown>).docker = this.getGitHubDockerJob(config);
    }

    // Deploy job
    if (config.features.deploy) {
      (workflow.jobs as Record<string, unknown>).deploy = this.getGitHubDeployJob(config);
    }

    return yaml.dump(workflow, { lineWidth: -1 });
  }

  /**
   * Get environment variables
   */
  private getEnvironmentVariables(config: CICDConfig): Record<string, string> {
    const env: Record<string, string> = {
      CI: 'true',
    };

    if (config.projectType === 'node') {
      env.NODE_ENV = 'test';
    } else if (config.projectType === 'python') {
      env.PYTHONUNBUFFERED = '1';
    }

    return env;
  }

  /**
   * Get GitHub lint job
   */
  private getGitHubLintJob(config: CICDConfig): Record<string, unknown> {
    const steps: unknown[] = [
      { uses: 'actions/checkout@v4' },
    ];

    if (config.projectType === 'node') {
      steps.push(
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: { 'node-version': '20', cache: 'npm' },
        },
        { name: 'Install dependencies', run: 'npm ci' },
        { name: 'Lint', run: 'npm run lint' }
      );
    } else if (config.projectType === 'python') {
      steps.push(
        {
          name: 'Setup Python',
          uses: 'actions/setup-python@v5',
          with: { 'python-version': '3.11' },
        },
        { name: 'Install dependencies', run: 'pip install ruff' },
        { name: 'Lint', run: 'ruff check .' }
      );
    } else if (config.projectType === 'go') {
      steps.push(
        {
          name: 'Setup Go',
          uses: 'actions/setup-go@v5',
          with: { 'go-version': '1.21' },
        },
        { name: 'Lint', run: 'go vet ./...' }
      );
    }

    return {
      'runs-on': 'ubuntu-latest',
      steps,
    };
  }

  /**
   * Get GitHub test job
   */
  private getGitHubTestJob(config: CICDConfig): Record<string, unknown> {
    const steps: unknown[] = [
      { uses: 'actions/checkout@v4' },
    ];

    if (config.projectType === 'node') {
      steps.push(
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: { 'node-version': '20', cache: 'npm' },
        },
        { name: 'Install dependencies', run: 'npm ci' },
        { name: 'Test', run: 'npm test' },
        {
          name: 'Upload coverage',
          uses: 'codecov/codecov-action@v3',
          if: 'always()',
        }
      );
    } else if (config.projectType === 'python') {
      steps.push(
        {
          name: 'Setup Python',
          uses: 'actions/setup-python@v5',
          with: { 'python-version': '3.11' },
        },
        { name: 'Install dependencies', run: 'pip install -r requirements.txt pytest pytest-cov' },
        { name: 'Test', run: 'pytest --cov --cov-report=xml' },
        {
          name: 'Upload coverage',
          uses: 'codecov/codecov-action@v3',
          if: 'always()',
        }
      );
    } else if (config.projectType === 'go') {
      steps.push(
        {
          name: 'Setup Go',
          uses: 'actions/setup-go@v5',
          with: { 'go-version': '1.21' },
        },
        { name: 'Test', run: 'go test -v -coverprofile=coverage.out ./...' }
      );
    }

    return {
      'runs-on': 'ubuntu-latest',
      needs: config.features.lint ? ['lint'] : [],
      steps,
    };
  }

  /**
   * Get GitHub security job
   */
  private getGitHubSecurityJob(config: CICDConfig): Record<string, unknown> {
    const steps: unknown[] = [
      { uses: 'actions/checkout@v4' },
    ];

    if (config.projectType === 'node') {
      steps.push(
        {
          name: 'Run npm audit',
          run: 'npm audit --audit-level=high',
          'continue-on-error': true,
        }
      );
    }

    // Add CodeQL for all projects
    steps.push(
      {
        name: 'Initialize CodeQL',
        uses: 'github/codeql-action/init@v3',
        with: {
          languages: this.getCodeQLLanguage(config.projectType),
        },
      },
      {
        name: 'Autobuild',
        uses: 'github/codeql-action/autobuild@v3',
      },
      {
        name: 'Perform CodeQL Analysis',
        uses: 'github/codeql-action/analyze@v3',
      }
    );

    return {
      'runs-on': 'ubuntu-latest',
      permissions: {
        'security-events': 'write',
      },
      steps,
    };
  }

  /**
   * Get CodeQL language
   */
  private getCodeQLLanguage(projectType: CICDConfig['projectType']): string {
    const mapping: Record<string, string> = {
      node: 'javascript-typescript',
      python: 'python',
      go: 'go',
      java: 'java',
      dotnet: 'csharp',
      rust: 'cpp', // Rust uses cpp in CodeQL
      generic: 'javascript-typescript',
    };
    return mapping[projectType];
  }

  /**
   * Get GitHub build job
   */
  private getGitHubBuildJob(config: CICDConfig): Record<string, unknown> {
    const steps: unknown[] = [
      { uses: 'actions/checkout@v4' },
    ];

    if (config.projectType === 'node') {
      steps.push(
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: { 'node-version': '20', cache: 'npm' },
        },
        { name: 'Install dependencies', run: 'npm ci' },
        { name: 'Build', run: 'npm run build' },
        {
          name: 'Upload build artifacts',
          uses: 'actions/upload-artifact@v4',
          with: {
            name: 'build',
            path: 'dist/',
          },
        }
      );
    } else if (config.projectType === 'go') {
      steps.push(
        {
          name: 'Setup Go',
          uses: 'actions/setup-go@v5',
          with: { 'go-version': '1.21' },
        },
        { name: 'Build', run: 'go build -v ./...' }
      );
    }

    return {
      'runs-on': 'ubuntu-latest',
      needs: ['test'],
      steps,
    };
  }

  /**
   * Get GitHub Docker job
   */
  private getGitHubDockerJob(config: CICDConfig): Record<string, unknown> {
    return {
      'runs-on': 'ubuntu-latest',
      needs: ['build'],
      if: "github.event_name == 'push' && github.ref == 'refs/heads/main'",
      steps: [
        { uses: 'actions/checkout@v4' },
        {
          name: 'Set up Docker Buildx',
          uses: 'docker/setup-buildx-action@v3',
        },
        {
          name: 'Login to Container Registry',
          uses: 'docker/login-action@v3',
          with: {
            registry: 'ghcr.io',
            username: '${{ github.actor }}',
            password: '${{ secrets.GITHUB_TOKEN }}',
          },
        },
        {
          name: 'Build and push',
          uses: 'docker/build-push-action@v5',
          with: {
            context: '.',
            push: true,
            tags: 'ghcr.io/${{ github.repository }}:latest,ghcr.io/${{ github.repository }}:${{ github.sha }}',
            cache_from: 'type=gha',
            cache_to: 'type=gha,mode=max',
          },
        },
      ],
    };
  }

  /**
   * Get GitHub deploy job
   */
  private getGitHubDeployJob(config: CICDConfig): Record<string, unknown> {
    return {
      'runs-on': 'ubuntu-latest',
      needs: config.features.docker ? ['docker'] : ['build'],
      if: "github.event_name == 'push' && github.ref == 'refs/heads/main'",
      environment: {
        name: 'production',
        url: '${{ steps.deploy.outputs.url }}',
      },
      steps: [
        { uses: 'actions/checkout@v4' },
        {
          name: 'Download build artifacts',
          uses: 'actions/download-artifact@v4',
          with: { name: 'build' },
        },
        {
          name: 'Deploy',
          id: 'deploy',
          run: 'echo "Deployment step - customize based on your infrastructure"',
        },
      ],
    };
  }

  /**
   * Generate GitLab CI configuration
   */
  private generateGitLabCI(config: CICDConfig): string {
    const pipeline: Record<string, unknown> = {
      stages: ['lint', 'test', 'security', 'build', 'deploy'].filter(stage => {
        if (stage === 'lint') return config.features.lint;
        if (stage === 'test') return config.features.test;
        if (stage === 'security') return config.features.security;
        if (stage === 'build') return config.features.build;
        if (stage === 'deploy') return config.features.deploy;
        return false;
      }),
      variables: this.getEnvironmentVariables(config),
    };

    if (config.features.lint) {
      (pipeline as Record<string, unknown>).lint = {
        stage: 'lint',
        image: this.getDockerImage(config.projectType),
        script: this.getLintScript(config.projectType),
      };
    }

    if (config.features.test) {
      (pipeline as Record<string, unknown>).test = {
        stage: 'test',
        image: this.getDockerImage(config.projectType),
        script: this.getTestScript(config.projectType),
        coverage: '/Coverage: \\d+\\.\\d+%/',
      };
    }

    if (config.features.build) {
      (pipeline as Record<string, unknown>).build = {
        stage: 'build',
        image: this.getDockerImage(config.projectType),
        script: this.getBuildScript(config.projectType),
        artifacts: {
          paths: ['dist/', 'build/'],
          expire_in: '1 week',
        },
      };
    }

    return yaml.dump(pipeline, { lineWidth: -1 });
  }

  /**
   * Generate Bitbucket Pipelines
   */
  private generateBitbucketPipelines(config: CICDConfig): string {
    const pipeline: Record<string, unknown> = {
      image: this.getDockerImage(config.projectType),
      pipelines: {
        default: [
          {
            step: {
              name: 'Build and Test',
              caches: [config.projectType === 'node' ? 'node' : 'pip'],
              script: [
                ...this.getLintScript(config.projectType),
                ...this.getTestScript(config.projectType),
                ...this.getBuildScript(config.projectType),
              ],
            },
          },
        ],
      },
    };

    return yaml.dump(pipeline, { lineWidth: -1 });
  }

  /**
   * Get Docker image for project type
   */
  private getDockerImage(projectType: CICDConfig['projectType']): string {
    const images: Record<string, string> = {
      node: 'node:20-alpine',
      python: 'python:3.11-slim',
      go: 'golang:1.21-alpine',
      rust: 'rust:1.75-slim',
      java: 'eclipse-temurin:21-jdk',
      dotnet: 'mcr.microsoft.com/dotnet/sdk:8.0',
      generic: 'ubuntu:latest',
    };
    return images[projectType];
  }

  /**
   * Get lint script
   */
  private getLintScript(projectType: CICDConfig['projectType']): string[] {
    const scripts: Record<string, string[]> = {
      node: ['npm ci', 'npm run lint'],
      python: ['pip install ruff', 'ruff check .'],
      go: ['go vet ./...'],
      rust: ['cargo fmt --check', 'cargo clippy'],
      java: ['./mvnw checkstyle:check'],
      dotnet: ['dotnet format --verify-no-changes'],
      generic: ['echo "No lint configured"'],
    };
    return scripts[projectType];
  }

  /**
   * Get test script
   */
  private getTestScript(projectType: CICDConfig['projectType']): string[] {
    const scripts: Record<string, string[]> = {
      node: ['npm ci', 'npm test'],
      python: ['pip install -r requirements.txt pytest', 'pytest'],
      go: ['go test -v ./...'],
      rust: ['cargo test'],
      java: ['./mvnw test'],
      dotnet: ['dotnet test'],
      generic: ['echo "No tests configured"'],
    };
    return scripts[projectType];
  }

  /**
   * Get build script
   */
  private getBuildScript(projectType: CICDConfig['projectType']): string[] {
    const scripts: Record<string, string[]> = {
      node: ['npm run build'],
      python: ['pip install build', 'python -m build'],
      go: ['go build -v ./...'],
      rust: ['cargo build --release'],
      java: ['./mvnw package -DskipTests'],
      dotnet: ['dotnet build --configuration Release'],
      generic: ['echo "No build configured"'],
    };
    return scripts[projectType];
  }

  /**
   * Save generated CI/CD config
   */
  async save(config: Partial<CICDConfig> = {}): Promise<string> {
    const content = await this.generate(config);
    const platform = config.platform || 'github';

    let outputPath: string;

    switch (platform) {
      case 'github':
        outputPath = path.join(this.projectRoot, '.github', 'workflows', 'ci.yml');
        break;
      case 'gitlab':
        outputPath = path.join(this.projectRoot, '.gitlab-ci.yml');
        break;
      case 'bitbucket':
        outputPath = path.join(this.projectRoot, 'bitbucket-pipelines.yml');
        break;
      default:
        outputPath = path.join(this.projectRoot, '.github', 'workflows', 'ci.yml');
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf-8');

    return outputPath;
  }

  /**
   * Generate Dockerfile
   */
  async generateDockerfile(projectType?: CICDConfig['projectType']): Promise<string> {
    const type = projectType || await this.detectProjectType();
    
    const dockerfiles: Record<string, string> = {
      node: `# Multi-stage build for Node.js application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
`,
      python: `# Multi-stage build for Python application
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim AS runner
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]
`,
      go: `# Multi-stage build for Go application
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main .

FROM alpine:latest AS runner
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
`,
      generic: `FROM ubuntu:latest
WORKDIR /app
COPY . .
CMD ["./start.sh"]
`,
    };

    return dockerfiles[type] || dockerfiles.generic;
  }

  /**
   * Save Dockerfile
   */
  async saveDockerfile(projectType?: CICDConfig['projectType']): Promise<string> {
    const content = await this.generateDockerfile(projectType);
    const outputPath = path.join(this.projectRoot, 'Dockerfile');
    
    await fs.writeFile(outputPath, content, 'utf-8');
    return outputPath;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createCICDGenerator(omgbuildDir: string): CICDGenerator {
  return new CICDGenerator(omgbuildDir);
}
