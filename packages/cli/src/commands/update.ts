/**
 * 🔮 OMGBUILD Update Command
 * Self-update from npm
 */

import { Command } from 'commander';
import { execSync } from 'child_process';

const VERSION = '0.6.0';

export const updateCommand = new Command('update')
  .description('Update OMGBUILD to latest version')
  .option('-c, --check', 'Check for updates without installing')
  .action(async (options: { check?: boolean }) => {
    console.log('🔄 Checking for updates...\n');

    try {
      // Get latest version from npm
      let latestVersion: string;
      try {
        latestVersion = execSync('npm view omgbuild version 2>/dev/null', { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        // Package might not be published yet
        console.log('📦 Package not found on npm yet.');
        console.log('   Current version: ' + VERSION);
        return;
      }

      console.log(`📦 Current version: ${VERSION}`);
      console.log(`📦 Latest version:  ${latestVersion}`);
      console.log();

      if (latestVersion === VERSION) {
        console.log('✅ Already on latest version!');
        return;
      }

      // Compare versions
      const current = VERSION.split('.').map(Number);
      const latest = latestVersion.split('.').map(Number);
      
      let needsUpdate = false;
      for (let i = 0; i < 3; i++) {
        if ((latest[i] || 0) > (current[i] || 0)) {
          needsUpdate = true;
          break;
        }
        if ((latest[i] || 0) < (current[i] || 0)) {
          break;
        }
      }

      if (!needsUpdate) {
        console.log('✅ You have a newer version than npm!');
        return;
      }

      if (options.check) {
        console.log(`⬆️  Update available: ${VERSION} → ${latestVersion}`);
        console.log('\nRun "omgbuild update" to install.');
        return;
      }

      console.log('🚀 Updating...\n');

      // Detect package manager
      let command = 'npm install -g omgbuild@latest';
      
      try {
        execSync('which yarn', { stdio: 'pipe' });
        const useYarn = process.env.npm_config_user_agent?.includes('yarn');
        if (useYarn) {
          command = 'yarn global add omgbuild@latest';
        }
      } catch {
        // npm is fine
      }

      execSync(command, { stdio: 'inherit' });

      console.log(`\n✅ Updated to ${latestVersion}!`);
      console.log('\n📋 What\'s new:');
      console.log('   Run "omgbuild changelog" to see changes.');

    } catch (error) {
      console.error('❌ Update failed:', (error as Error).message);
      console.error('\nTry manually:');
      console.error('   npm install -g omgbuild@latest');
      process.exit(1);
    }
  });
