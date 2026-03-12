/**
 * State module — SQLite persistence layer.
 *
 * Re-exports database utilities and all repositories.
 */
export {
  openDatabase,
  openTestDatabase,
  nowISO,
  DB_FILENAME,
  MIGRATIONS,
  DatabaseCorruptionError,
  MigrationError,
} from './database.js';

export type {
  DatabaseOptions,
  Migration,
} from './database.js';

// All repositories
export * from './repos/index.js';
