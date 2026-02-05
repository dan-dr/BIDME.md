export interface Migration {
  version: string;
  description: string;
  migrate: (targetDir: string) => Promise<void>;
}

import { v020Migration } from "./v0.2.0.js";

export const migrations: Migration[] = [v020Migration].sort((a, b) =>
  a.version.localeCompare(b.version, undefined, { numeric: true }),
);

export function getMigrationsAfter(currentVersion: string): Migration[] {
  return migrations.filter(
    (m) => m.version.localeCompare(currentVersion, undefined, { numeric: true }) > 0,
  );
}
