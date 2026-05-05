import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";
import migrations from "./drizzle/migrations";

const expoDb = openDatabaseSync("x-ledger.db");

export const db = drizzle(expoDb);

const REQUIRED_TABLES = ["transactions", "assets", "categories", "configs"] as const;

async function getExistingTables(): Promise<string[]> {
  const rows = await expoDb.getAllAsync<{ name: string }>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `);

  return rows.map((row) => row.name);
}

async function getMissingRequiredTables(): Promise<string[]> {
  const existingTables = new Set(await getExistingTables());
  return REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));
}

export async function initializeDatabase() {
  await expoDb.execAsync("PRAGMA foreign_keys = ON;");
  await migrate(db, migrations);

  const missingTables = await getMissingRequiredTables();

  if (missingTables.length > 0) {
    throw new Error(`Database initialization incomplete. Missing tables: ${missingTables.join(", ")}`);
  }
}
