/**
 * 🔮 OMGBUILD Phase 6 - Registry Client
 * Interact with artifact registries (local, remote, git)
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type ArtifactType = 
  | 'skill' 
  | 'workflow' 
  | 'pipeline' 
  | 'template' 
  | 'agent' 
  | 'plugin'
  | 'config';

export type RegistryType = 'local' | 'git' | 'remote';

export interface ArtifactManifest {
  name: string;
  version: string;
  type: ArtifactType;
  description: string;
  author?: string;
  license?: string;
  tags?: string[];
  dependencies?: string[];
  files: string[];
  main?: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  repository?: string;
  homepage?: string;
}

export interface RegistryConfig {
  name: string;
  type: RegistryType;
  url: string;
  branch?: string;
  token?: string;
  priority: number;
  enabled: boolean;
}

export interface RegistryIndex {
  version: string;
  updatedAt: string;
  artifacts: {
    [type: string]: {
      [name: string]: {
        versions: string[];
        latest: string;
        description: string;
        author?: string;
        downloads?: number;
      };
    };
  };
}

export interface PullOptions {
  version?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface PushOptions {
  message?: string;
  tags?: string[];
  public?: boolean;
}

export interface SearchResult {
  name: string;
  type: ArtifactType;
  version: string;
  description: string;
  author?: string;
  registry: string;
  downloads?: number;
  score?: number;
}

// ============================================================================
// REGISTRY CLIENT
// ============================================================================

export class RegistryClient {
  private omgbuildDir: string;
  private registryDir: string;
  private cacheDir: string;
  private registries: RegistryConfig[] = [];
  private index: RegistryIndex | null = null;

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.registryDir = path.join(omgbuildDir, 'registry');
    this.cacheDir = path.join(omgbuildDir, 'registry', '.cache');
  }

  /**
   * Initialize registry client
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.registryDir);
    await fs.ensureDir(this.cacheDir);
    await this.loadRegistries();
    await this.loadIndex();
  }

  // ==========================================================================
  // REGISTRY MANAGEMENT
  // ==========================================================================

  /**
   * Add a registry source
   */
  async addRegistry(config: Omit<RegistryConfig, 'priority'>): Promise<void> {
    const priority = this.registries.length;
    this.registries.push({ ...config, priority });
    await this.saveRegistries();
  }

  /**
   * Remove a registry source
   */
  async removeRegistry(name: string): Promise<boolean> {
    const index = this.registries.findIndex(r => r.name === name);
    if (index === -1) return false;
    
    this.registries.splice(index, 1);
    await this.saveRegistries();
    return true;
  }

  /**
   * List configured registries
   */
  getRegistries(): RegistryConfig[] {
    return [...this.registries];
  }

  /**
   * Set default registry
   */
  async setDefaultRegistry(name: string): Promise<void> {
    const registry = this.registries.find(r => r.name === name);
    if (!registry) throw new Error(`Registry not found: ${name}`);
    
    // Move to top priority
    this.registries = this.registries.filter(r => r.name !== name);
    this.registries.unshift({ ...registry, priority: 0 });
    
    // Reorder priorities
    this.registries.forEach((r, i) => r.priority = i);
    await this.saveRegistries();
  }

  // ==========================================================================
  // ARTIFACT OPERATIONS
  // ==========================================================================

  /**
   * Pull an artifact from registry
   */
  async pull(
    artifactSpec: string,  // format: type/name or type/name@version
    options: PullOptions = {}
  ): Promise<{
    success: boolean;
    artifact?: ArtifactManifest;
    path?: string;
    message: string;
  }> {
    // Parse artifact spec
    const { type, name, version } = this.parseArtifactSpec(artifactSpec);
    const targetVersion = options.version || version || 'latest';

    // Find artifact in registries
    const found = await this.findArtifact(type, name, targetVersion);
    if (!found) {
      return {
        success: false,
        message: `Artifact not found: ${artifactSpec}`,
      };
    }

    const { registry, manifest, artifactPath } = found;

    // Check if already installed
    const localPath = this.getLocalArtifactPath(type, name);
    if (await fs.pathExists(localPath) && !options.force) {
      const localManifest = await this.loadManifest(localPath);
      if (localManifest?.version === manifest.version) {
        return {
          success: true,
          artifact: localManifest,
          path: localPath,
          message: `Already installed: ${name}@${manifest.version}`,
        };
      }
    }

    if (options.dryRun) {
      return {
        success: true,
        artifact: manifest,
        message: `Would install: ${name}@${manifest.version} from ${registry.name}`,
      };
    }

    // Copy artifact to local
    await fs.ensureDir(path.dirname(localPath));
    await fs.copy(artifactPath, localPath);

    // Update local manifest
    const installedManifest = await this.loadManifest(localPath);

    return {
      success: true,
      artifact: installedManifest || manifest,
      path: localPath,
      message: `Installed: ${name}@${manifest.version}`,
    };
  }

  /**
   * Push an artifact to registry
   */
  async push(
    artifactPath: string,
    registryName?: string,
    options: PushOptions = {}
  ): Promise<{
    success: boolean;
    message: string;
    url?: string;
  }> {
    // Load manifest
    const manifest = await this.loadManifest(artifactPath);
    if (!manifest) {
      return {
        success: false,
        message: 'No manifest.yaml found in artifact',
      };
    }

    // Find target registry
    const registry = registryName
      ? this.registries.find(r => r.name === registryName)
      : this.registries.find(r => r.enabled);

    if (!registry) {
      return {
        success: false,
        message: registryName
          ? `Registry not found: ${registryName}`
          : 'No registry configured',
      };
    }

    // Calculate checksum
    manifest.checksum = await this.calculateChecksum(artifactPath);
    manifest.updatedAt = new Date().toISOString();

    // Save updated manifest
    await this.saveManifest(artifactPath, manifest);

    // Push based on registry type
    switch (registry.type) {
      case 'local':
        return this.pushToLocal(artifactPath, manifest, registry);
      case 'git':
        return this.pushToGit(artifactPath, manifest, registry, options);
      case 'remote':
        return this.pushToRemote(artifactPath, manifest, registry, options);
      default:
        return { success: false, message: `Unknown registry type: ${registry.type}` };
    }
  }

  /**
   * Search for artifacts
   */
  async search(query: string, filters?: {
    type?: ArtifactType;
    tags?: string[];
    author?: string;
  }): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    // Search in index
    if (this.index) {
      for (const [type, artifacts] of Object.entries(this.index.artifacts)) {
        if (filters?.type && type !== filters.type) continue;

        for (const [name, info] of Object.entries(artifacts)) {
          const matchName = name.toLowerCase().includes(queryLower);
          const matchDesc = info.description.toLowerCase().includes(queryLower);

          if (matchName || matchDesc) {
            results.push({
              name,
              type: type as ArtifactType,
              version: info.latest,
              description: info.description,
              author: info.author,
              registry: 'index',
              downloads: info.downloads,
              score: matchName ? 2 : 1,
            });
          }
        }
      }
    }

    // Search in local registries
    for (const registry of this.registries.filter(r => r.enabled)) {
      if (registry.type === 'local') {
        const localResults = await this.searchLocal(registry, query, filters);
        results.push(...localResults);
      }
    }

    // Sort by score
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * List installed artifacts
   */
  async listInstalled(type?: ArtifactType): Promise<ArtifactManifest[]> {
    const installed: ArtifactManifest[] = [];
    const types = type ? [type] : ['skill', 'workflow', 'pipeline', 'template', 'agent', 'plugin'];

    for (const t of types) {
      const typePath = path.join(this.omgbuildDir, `${t}s`);
      if (!await fs.pathExists(typePath)) continue;

      const items = await fs.readdir(typePath);
      for (const item of items) {
        const itemPath = path.join(typePath, item);
        const manifest = await this.loadManifest(itemPath);
        if (manifest) {
          installed.push(manifest);
        }
      }
    }

    return installed;
  }

  /**
   * Check for updates
   */
  async checkUpdates(): Promise<Array<{
    name: string;
    type: ArtifactType;
    installed: string;
    available: string;
    registry: string;
  }>> {
    const updates: Array<{
      name: string;
      type: ArtifactType;
      installed: string;
      available: string;
      registry: string;
    }> = [];

    const installed = await this.listInstalled();

    for (const manifest of installed) {
      const found = await this.findArtifact(manifest.type, manifest.name, 'latest');
      if (found && this.compareVersions(found.manifest.version, manifest.version) > 0) {
        updates.push({
          name: manifest.name,
          type: manifest.type,
          installed: manifest.version,
          available: found.manifest.version,
          registry: found.registry.name,
        });
      }
    }

    return updates;
  }

  /**
   * Sync all artifacts from registry
   */
  async sync(options?: {
    type?: ArtifactType;
    force?: boolean;
  }): Promise<{
    pulled: string[];
    skipped: string[];
    failed: string[];
  }> {
    const result = {
      pulled: [] as string[],
      skipped: [] as string[],
      failed: [] as string[],
    };

    // Refresh index
    await this.refreshIndex();

    if (!this.index) {
      return result;
    }

    for (const [type, artifacts] of Object.entries(this.index.artifacts)) {
      if (options?.type && type !== options.type) continue;

      for (const [name, info] of Object.entries(artifacts)) {
        const spec = `${type}/${name}`;
        const pullResult = await this.pull(spec, { force: options?.force });

        if (pullResult.success) {
          if (pullResult.message.includes('Already installed')) {
            result.skipped.push(spec);
          } else {
            result.pulled.push(spec);
          }
        } else {
          result.failed.push(spec);
        }
      }
    }

    return result;
  }

  // ==========================================================================
  // INDEX MANAGEMENT
  // ==========================================================================

  /**
   * Refresh index from all registries
   */
  async refreshIndex(): Promise<void> {
    const combined: RegistryIndex = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      artifacts: {},
    };

    for (const registry of this.registries.filter(r => r.enabled)) {
      try {
        const index = await this.fetchRegistryIndex(registry);
        if (index) {
          // Merge artifacts
          for (const [type, artifacts] of Object.entries(index.artifacts)) {
            if (!combined.artifacts[type]) {
              combined.artifacts[type] = {};
            }
            Object.assign(combined.artifacts[type], artifacts);
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch index from ${registry.name}:`, error);
      }
    }

    this.index = combined;
    await this.saveIndex();
  }

  /**
   * Build index from local artifacts
   */
  async buildIndex(): Promise<RegistryIndex> {
    const index: RegistryIndex = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      artifacts: {},
    };

    const types: ArtifactType[] = ['skill', 'workflow', 'pipeline', 'template', 'agent', 'plugin'];

    for (const type of types) {
      index.artifacts[type] = {};
      const typePath = path.join(this.registryDir, `${type}s`);
      
      if (!await fs.pathExists(typePath)) continue;

      const items = await fs.readdir(typePath);
      for (const item of items) {
        const itemPath = path.join(typePath, item);
        const manifest = await this.loadManifest(itemPath);
        
        if (manifest) {
          index.artifacts[type][manifest.name] = {
            versions: [manifest.version],
            latest: manifest.version,
            description: manifest.description,
            author: manifest.author,
          };
        }
      }
    }

    return index;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private parseArtifactSpec(spec: string): {
    type: ArtifactType;
    name: string;
    version?: string;
  } {
    // Format: type/name or type/name@version
    const [typeName, version] = spec.split('@');
    const [type, ...nameParts] = typeName.split('/');
    const name = nameParts.join('/');

    return {
      type: type as ArtifactType,
      name,
      version,
    };
  }

  private async findArtifact(
    type: ArtifactType,
    name: string,
    version: string
  ): Promise<{
    registry: RegistryConfig;
    manifest: ArtifactManifest;
    artifactPath: string;
  } | null> {
    for (const registry of this.registries.filter(r => r.enabled)) {
      const artifactPath = await this.locateArtifact(registry, type, name, version);
      if (artifactPath) {
        const manifest = await this.loadManifest(artifactPath);
        if (manifest) {
          return { registry, manifest, artifactPath };
        }
      }
    }
    return null;
  }

  private async locateArtifact(
    registry: RegistryConfig,
    type: ArtifactType,
    name: string,
    version: string
  ): Promise<string | null> {
    switch (registry.type) {
      case 'local': {
        const basePath = path.join(registry.url, `${type}s`, name);
        if (version === 'latest') {
          if (await fs.pathExists(basePath)) return basePath;
        } else {
          const versionPath = path.join(basePath, version);
          if (await fs.pathExists(versionPath)) return versionPath;
          if (await fs.pathExists(basePath)) return basePath;
        }
        return null;
      }

      case 'git': {
        // Clone/pull and locate
        const cacheKey = this.getCacheKey(registry.name, type, name, version);
        const cachePath = path.join(this.cacheDir, cacheKey);
        
        if (await fs.pathExists(cachePath)) {
          return cachePath;
        }
        
        // Need to clone
        const cloned = await this.cloneGitArtifact(registry, type, name, version);
        return cloned;
      }

      case 'remote':
        // Download from URL
        // TODO: Implement remote download
        return null;

      default:
        return null;
    }
  }

  private getLocalArtifactPath(type: ArtifactType, name: string): string {
    return path.join(this.omgbuildDir, `${type}s`, name);
  }

  private async loadManifest(artifactPath: string): Promise<ArtifactManifest | null> {
    const manifestPath = path.join(artifactPath, 'manifest.yaml');
    if (!await fs.pathExists(manifestPath)) {
      // Try manifest.yml
      const altPath = path.join(artifactPath, 'manifest.yml');
      if (!await fs.pathExists(altPath)) return null;
      const content = await fs.readFile(altPath, 'utf-8');
      return yaml.load(content) as ArtifactManifest;
    }
    const content = await fs.readFile(manifestPath, 'utf-8');
    return yaml.load(content) as ArtifactManifest;
  }

  private async saveManifest(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    const manifestPath = path.join(artifactPath, 'manifest.yaml');
    await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf-8');
  }

  private async calculateChecksum(artifactPath: string): Promise<string> {
    const hash = createHash('sha256');
    const files = await this.getArtifactFiles(artifactPath);
    
    for (const file of files.sort()) {
      const content = await fs.readFile(path.join(artifactPath, file));
      hash.update(content);
    }
    
    return hash.digest('hex').slice(0, 16);
  }

  private async getArtifactFiles(artifactPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string, prefix: string = '') => {
      const items = await fs.readdir(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;
        const fullPath = path.join(dir, item);
        const relativePath = path.join(prefix, item);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    };
    
    await walk(artifactPath);
    return files;
  }

  private getCacheKey(...parts: string[]): string {
    return parts.map(p => p.replace(/[^a-zA-Z0-9-_]/g, '_')).join('_');
  }

  private async cloneGitArtifact(
    registry: RegistryConfig,
    type: ArtifactType,
    name: string,
    version: string
  ): Promise<string | null> {
    const cacheKey = this.getCacheKey(registry.name, type, name, version);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      // Clone repository
      const branch = registry.branch || 'main';
      const subPath = `${type}s/${name}`;
      
      // Sparse checkout for specific artifact
      const tempDir = path.join(this.cacheDir, `temp_${Date.now()}`);
      await fs.ensureDir(tempDir);

      execSync(`git clone --depth 1 --branch ${branch} --filter=blob:none --sparse ${registry.url} .`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      execSync(`git sparse-checkout set ${subPath}`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      // Move to cache
      const artifactSrc = path.join(tempDir, subPath);
      if (await fs.pathExists(artifactSrc)) {
        await fs.move(artifactSrc, cachePath, { overwrite: true });
      }

      // Cleanup
      await fs.remove(tempDir);

      return await fs.pathExists(cachePath) ? cachePath : null;
    } catch (error) {
      console.error(`Failed to clone artifact: ${error}`);
      return null;
    }
  }

  private async pushToLocal(
    artifactPath: string,
    manifest: ArtifactManifest,
    registry: RegistryConfig
  ): Promise<{ success: boolean; message: string; url?: string }> {
    const targetPath = path.join(registry.url, `${manifest.type}s`, manifest.name);
    await fs.ensureDir(path.dirname(targetPath));
    await fs.copy(artifactPath, targetPath);

    // Update index
    await this.updateLocalIndex(registry, manifest);

    return {
      success: true,
      message: `Pushed ${manifest.name}@${manifest.version} to ${registry.name}`,
      url: targetPath,
    };
  }

  private async pushToGit(
    artifactPath: string,
    manifest: ArtifactManifest,
    registry: RegistryConfig,
    options: PushOptions
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // Clone, copy, commit, push
    const tempDir = path.join(this.cacheDir, `push_${Date.now()}`);
    
    try {
      await fs.ensureDir(tempDir);
      
      // Clone
      execSync(`git clone --depth 1 ${registry.url} .`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      // Copy artifact
      const targetPath = path.join(tempDir, `${manifest.type}s`, manifest.name);
      await fs.ensureDir(path.dirname(targetPath));
      await fs.copy(artifactPath, targetPath);

      // Commit and push
      const message = options.message || `Add ${manifest.name}@${manifest.version}`;
      execSync(`git add . && git commit -m "${message}" && git push`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      // Cleanup
      await fs.remove(tempDir);

      return {
        success: true,
        message: `Pushed ${manifest.name}@${manifest.version} to ${registry.name}`,
        url: `${registry.url}/tree/${registry.branch || 'main'}/${manifest.type}s/${manifest.name}`,
      };
    } catch (error) {
      await fs.remove(tempDir);
      return {
        success: false,
        message: `Failed to push: ${(error as Error).message}`,
      };
    }
  }

  private async pushToRemote(
    artifactPath: string,
    manifest: ArtifactManifest,
    registry: RegistryConfig,
    options: PushOptions
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // TODO: Implement remote API push
    return {
      success: false,
      message: 'Remote push not yet implemented',
    };
  }

  private async updateLocalIndex(registry: RegistryConfig, manifest: ArtifactManifest): Promise<void> {
    const indexPath = path.join(registry.url, 'index.yaml');
    let index: RegistryIndex;

    if (await fs.pathExists(indexPath)) {
      const content = await fs.readFile(indexPath, 'utf-8');
      index = yaml.load(content) as RegistryIndex;
    } else {
      index = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        artifacts: {},
      };
    }

    // Update artifact entry
    if (!index.artifacts[manifest.type]) {
      index.artifacts[manifest.type] = {};
    }

    const existing = index.artifacts[manifest.type][manifest.name];
    if (existing) {
      if (!existing.versions.includes(manifest.version)) {
        existing.versions.push(manifest.version);
      }
      existing.latest = manifest.version;
      existing.description = manifest.description;
      existing.author = manifest.author;
    } else {
      index.artifacts[manifest.type][manifest.name] = {
        versions: [manifest.version],
        latest: manifest.version,
        description: manifest.description,
        author: manifest.author,
      };
    }

    index.updatedAt = new Date().toISOString();
    await fs.writeFile(indexPath, yaml.dump(index), 'utf-8');
  }

  private async searchLocal(
    registry: RegistryConfig,
    query: string,
    filters?: { type?: ArtifactType; tags?: string[]; author?: string }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const types: ArtifactType[] = filters?.type 
      ? [filters.type] 
      : ['skill', 'workflow', 'pipeline', 'template', 'agent', 'plugin'];

    for (const type of types) {
      const typePath = path.join(registry.url, `${type}s`);
      if (!await fs.pathExists(typePath)) continue;

      const items = await fs.readdir(typePath);
      for (const item of items) {
        const itemPath = path.join(typePath, item);
        const manifest = await this.loadManifest(itemPath);
        
        if (manifest) {
          const matchName = manifest.name.toLowerCase().includes(queryLower);
          const matchDesc = manifest.description.toLowerCase().includes(queryLower);
          const matchTags = manifest.tags?.some(t => t.toLowerCase().includes(queryLower));

          if (matchName || matchDesc || matchTags) {
            results.push({
              name: manifest.name,
              type: manifest.type,
              version: manifest.version,
              description: manifest.description,
              author: manifest.author,
              registry: registry.name,
              score: matchName ? 2 : 1,
            });
          }
        }
      }
    }

    return results;
  }

  private async fetchRegistryIndex(registry: RegistryConfig): Promise<RegistryIndex | null> {
    switch (registry.type) {
      case 'local': {
        const indexPath = path.join(registry.url, 'index.yaml');
        if (await fs.pathExists(indexPath)) {
          const content = await fs.readFile(indexPath, 'utf-8');
          return yaml.load(content) as RegistryIndex;
        }
        // Build index if not exists
        return this.buildIndex();
      }

      case 'git': {
        // Fetch index.yaml from git
        const cacheKey = this.getCacheKey(registry.name, 'index');
        const cachePath = path.join(this.cacheDir, cacheKey, 'index.yaml');
        
        if (await fs.pathExists(cachePath)) {
          const content = await fs.readFile(cachePath, 'utf-8');
          return yaml.load(content) as RegistryIndex;
        }
        return null;
      }

      case 'remote': {
        // Fetch from URL
        // TODO: Implement
        return null;
      }

      default:
        return null;
    }
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  private async loadRegistries(): Promise<void> {
    const configPath = path.join(this.registryDir, 'registries.yaml');
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      this.registries = yaml.load(content) as RegistryConfig[] || [];
    } else {
      // Default registries
      this.registries = [
        {
          name: 'local',
          type: 'local',
          url: this.registryDir,
          priority: 0,
          enabled: true,
        },
      ];
    }
  }

  private async saveRegistries(): Promise<void> {
    const configPath = path.join(this.registryDir, 'registries.yaml');
    await fs.writeFile(configPath, yaml.dump(this.registries), 'utf-8');
  }

  private async loadIndex(): Promise<void> {
    const indexPath = path.join(this.registryDir, 'index.yaml');
    if (await fs.pathExists(indexPath)) {
      const content = await fs.readFile(indexPath, 'utf-8');
      this.index = yaml.load(content) as RegistryIndex;
    }
  }

  private async saveIndex(): Promise<void> {
    const indexPath = path.join(this.registryDir, 'index.yaml');
    await fs.writeFile(indexPath, yaml.dump(this.index), 'utf-8');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createRegistryClient(omgbuildDir: string): Promise<RegistryClient> {
  const client = new RegistryClient(omgbuildDir);
  await client.initialize();
  return client;
}
