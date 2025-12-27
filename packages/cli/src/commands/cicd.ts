/**
 * 🔮 OMGBUILD CI/CD Command
 * Generate CI/CD pipelines for various platforms
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createCICDGenerator, CICDPlatform } from '../core/cicd-generator';

// ============================================================================
// CICD COMMAND
// ============================================================================

export const cicdCommand = new Command('cicd')
  .description('Generate CI/CD pipelines for your project')
  .action(() => {
    console.log(`
🔮 OMGBUILD CI/CD Generator

Commands:
  omgbuild cicd generate [platform]    Generate CI/CD pipeline
  omgbuild cicd docker                 Generate Dockerfile
  omgbuild cicd detect                 Detect project type

Options for generate:
  --platform    github, gitlab, bitbucket, azure, jenkins
  --lint        Include linting (default: true)
  --test        Include tests (default: true)
  --security    Include security scan (default: true)
  --build       Include build step (default: true)
  --deploy      Include deployment (default: false)
  --docker      Include Docker build (default: false)

Examples:
  omgbuild cicd generate                    # Auto-detect, GitHub Actions
  omgbuild cicd generate --platform gitlab  # GitLab CI
  omgbuild cicd generate --deploy --docker  # Full pipeline
  omgbuild cicd docker                      # Generate Dockerfile
`);
  });

// ============================================================================
// GENERATE COMMAND
// ============================================================================

cicdCommand
  .command('generate [platform]')
  .alias('gen')
  .description('Generate CI/CD pipeline configuration')
  .option('--lint', 'Include linting step', true)
  .option('--no-lint', 'Exclude linting step')
  .option('--test', 'Include test step', true)
  .option('--no-test', 'Exclude test step')
  .option('--security', 'Include security scan', true)
  .option('--no-security', 'Exclude security scan')
  .option('--build', 'Include build step', true)
  .option('--no-build', 'Exclude build step')
  .option('--deploy', 'Include deployment step')
  .option('--docker', 'Include Docker build step')
  .option('--branch <branch>', 'Main branch name', 'main')
  .option('--dry-run', 'Show output without saving')
  .action(async (
    platform: string | undefined,
    options: {
      lint: boolean;
      test: boolean;
      security: boolean;
      build: boolean;
      deploy?: boolean;
      docker?: boolean;
      branch: string;
      dryRun?: boolean;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    // Allow running without .omgbuild directory
    const generator = createCICDGenerator(
      await fs.pathExists(omgbuildDir) ? omgbuildDir : process.cwd()
    );

    const projectType = await generator.detectProjectType();
    const selectedPlatform = (platform || 'github') as CICDPlatform;

    console.log(`
🔮 CI/CD Pipeline Generator
${'═'.repeat(50)}

   Project Type: ${projectType}
   Platform:     ${selectedPlatform}
   Features:     ${[
      options.lint && 'lint',
      options.test && 'test',
      options.security && 'security',
      options.build && 'build',
      options.deploy && 'deploy',
      options.docker && 'docker',
    ].filter(Boolean).join(', ')}

`);

    try {
      const config = {
        platform: selectedPlatform,
        projectType,
        features: {
          lint: options.lint,
          test: options.test,
          build: options.build,
          security: options.security,
          deploy: options.deploy || false,
          docker: options.docker || false,
        },
        branches: {
          main: options.branch,
        },
      };

      if (options.dryRun) {
        const content = await generator.generate(config);
        console.log('📄 Generated configuration:\n');
        console.log('─'.repeat(50));
        console.log(content);
        console.log('─'.repeat(50));
        console.log('\nUse without --dry-run to save to disk.');
      } else {
        const outputPath = await generator.save(config);
        console.log(`✅ CI/CD pipeline generated!`);
        console.log(`   📁 ${path.relative(process.cwd(), outputPath)}`);
        
        // Show platform-specific next steps
        console.log(`
📋 Next Steps:
`);
        if (selectedPlatform === 'github') {
          console.log(`   1. Commit the .github/workflows/ci.yml file`);
          console.log(`   2. Push to GitHub`);
          console.log(`   3. Pipeline will run on push/PR to ${options.branch}`);
        } else if (selectedPlatform === 'gitlab') {
          console.log(`   1. Commit the .gitlab-ci.yml file`);
          console.log(`   2. Push to GitLab`);
          console.log(`   3. Pipeline will run automatically`);
        }

        if (options.deploy) {
          console.log(`
⚠️  Deployment Configured:
   - Review the deploy job in the generated file
   - Add required secrets (API keys, credentials)
   - Configure your deployment target
`);
        }
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// DOCKER COMMAND
// ============================================================================

cicdCommand
  .command('docker')
  .description('Generate Dockerfile for the project')
  .option('--type <type>', 'Project type (node, python, go, rust, java, dotnet)')
  .option('--dry-run', 'Show output without saving')
  .action(async (options: { type?: string; dryRun?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    const generator = createCICDGenerator(
      await fs.pathExists(omgbuildDir) ? omgbuildDir : process.cwd()
    );

    const projectType = options.type as any || await generator.detectProjectType();

    console.log(`
🐳 Dockerfile Generator
${'═'.repeat(50)}

   Project Type: ${projectType}

`);

    try {
      if (options.dryRun) {
        const content = await generator.generateDockerfile(projectType);
        console.log('📄 Generated Dockerfile:\n');
        console.log('─'.repeat(50));
        console.log(content);
        console.log('─'.repeat(50));
      } else {
        const outputPath = await generator.saveDockerfile(projectType);
        console.log(`✅ Dockerfile generated!`);
        console.log(`   📁 ${path.relative(process.cwd(), outputPath)}`);
        console.log(`
📋 Next Steps:
   1. Review and customize the Dockerfile
   2. Build: docker build -t myapp .
   3. Run:   docker run -p 3000:3000 myapp

💡 Tip: Add .dockerignore to exclude node_modules, .git, etc.
`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// DETECT COMMAND
// ============================================================================

cicdCommand
  .command('detect')
  .description('Detect project type and show recommendations')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    const generator = createCICDGenerator(
      await fs.pathExists(omgbuildDir) ? omgbuildDir : process.cwd()
    );

    const projectType = await generator.detectProjectType();

    const recommendations: Record<string, { test: string; lint: string; build: string }> = {
      node: {
        test: 'npm test / jest / vitest',
        lint: 'eslint / biome',
        build: 'npm run build / tsc',
      },
      python: {
        test: 'pytest / unittest',
        lint: 'ruff / black / flake8',
        build: 'python -m build / poetry build',
      },
      go: {
        test: 'go test ./...',
        lint: 'go vet / golangci-lint',
        build: 'go build',
      },
      rust: {
        test: 'cargo test',
        lint: 'cargo clippy / cargo fmt',
        build: 'cargo build --release',
      },
      java: {
        test: 'mvn test / gradle test',
        lint: 'checkstyle / spotbugs',
        build: 'mvn package / gradle build',
      },
      dotnet: {
        test: 'dotnet test',
        lint: 'dotnet format',
        build: 'dotnet build / dotnet publish',
      },
      generic: {
        test: 'Custom test script',
        lint: 'Custom lint script',
        build: 'Custom build script',
      },
    };

    const rec = recommendations[projectType];

    console.log(`
🔍 Project Detection
${'═'.repeat(50)}

   Detected Type: ${projectType.toUpperCase()}

📋 Recommended Tools:

   Testing:   ${rec.test}
   Linting:   ${rec.lint}
   Building:  ${rec.build}

🚀 Quick Start:

   # Generate GitHub Actions pipeline
   omgbuild cicd generate

   # Generate with all features
   omgbuild cicd generate --deploy --docker

   # Generate Dockerfile
   omgbuild cicd docker
`);
  });
