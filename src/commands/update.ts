import { join, resolve } from "path";
import { migrations, getMigrationsAfter, type Migration } from "../lib/migrations/index.js";

export interface VersionInfo {
  version: string;
  installed_at: string;
  last_updated: string;
}

export interface UpdateResult {
  success: boolean;
  alreadyUpToDate: boolean;
  migrationsRun: string[];
  errors: string[];
}

async function getPackageVersion(): Promise<string> {
  const pkgPath = resolve(import.meta.dir, "../../package.json");
  const pkg = JSON.parse(await Bun.file(pkgPath).text());
  return pkg.version;
}

async function loadVersionInfo(targetDir: string): Promise<VersionInfo | null> {
  const versionPath = join(targetDir, ".bidme", "version.json");
  try {
    const file = Bun.file(versionPath);
    if (!(await file.exists())) return null;
    return JSON.parse(await file.text()) as VersionInfo;
  } catch {
    return null;
  }
}

async function saveVersionInfo(targetDir: string, version: string): Promise<void> {
  const fs = await import("fs/promises");
  const bidmeDir = join(targetDir, ".bidme");
  await fs.mkdir(bidmeDir, { recursive: true });

  const versionPath = join(bidmeDir, "version.json");
  const existing = await loadVersionInfo(targetDir);

  const info: VersionInfo = {
    version,
    installed_at: existing?.installed_at ?? new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  await Bun.write(versionPath, JSON.stringify(info, null, 2));
}

function detectLegacyInstall(targetDir: string): Promise<boolean> {
  const oldConfigPath = join(targetDir, "bidme-config.yml");
  return Bun.file(oldConfigPath).exists();
}

export async function runUpdate(options: { target: string }): Promise<UpdateResult> {
  const targetDir = resolve(options.target);
  const packageVersion = await getPackageVersion();

  const result: UpdateResult = {
    success: true,
    alreadyUpToDate: false,
    migrationsRun: [],
    errors: [],
  };

  const versionInfo = await loadVersionInfo(targetDir);
  const isLegacy = await detectLegacyInstall(targetDir);

  if (versionInfo && versionInfo.version === packageVersion) {
    console.log(`✓ Already up to date! (v${packageVersion})`);
    result.alreadyUpToDate = true;
    return result;
  }

  let pendingMigrations: Migration[];

  if (!versionInfo && isLegacy) {
    console.log("Detected legacy BidMe v1 installation. Running full migration...");
    pendingMigrations = migrations;
  } else if (versionInfo) {
    console.log(`Upgrading from v${versionInfo.version} to v${packageVersion}...`);
    pendingMigrations = getMigrationsAfter(versionInfo.version);
  } else {
    console.log("No BidMe installation detected. Run `bidme init` first.");
    result.success = false;
    result.errors.push("No BidMe installation found");
    return result;
  }

  if (pendingMigrations.length === 0) {
    await saveVersionInfo(targetDir, packageVersion);
    console.log(`✓ Already up to date! (v${packageVersion})`);
    result.alreadyUpToDate = true;
    return result;
  }

  for (const migration of pendingMigrations) {
    console.log(`  Running migration: ${migration.description}...`);
    try {
      await migration.migrate(targetDir);
      result.migrationsRun.push(migration.version);
      console.log(`  ✓ v${migration.version} migration complete`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Migration v${migration.version} failed: ${msg}`);
      result.success = false;
      console.error(`  ✗ v${migration.version} migration failed: ${msg}`);
      return result;
    }
  }

  await saveVersionInfo(targetDir, packageVersion);

  console.log(`\n✓ Updated to v${packageVersion}`);
  console.log(`  Migrations run: ${result.migrationsRun.join(", ")}`);

  return result;
}
