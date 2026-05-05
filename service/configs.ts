import { db } from "@/db/client";
import { configs, type Config, type NewConfig } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function getAllConfigs(): Promise<Config[]> {
  return db.select().from(configs).orderBy(asc(configs.config_key));
}

export async function getConfigByKey(config_key: string): Promise<Config | undefined> {
  const result = await db.select().from(configs).where(eq(configs.config_key, config_key));
  return result[0];
}

export async function getConfigValue(config_key: string): Promise<string | undefined> {
  const result = await getConfigByKey(config_key);
  return result?.config_value;
}

export async function createConfig(data: NewConfig): Promise<Config> {
  const result = await db.insert(configs).values(data).returning();
  return result[0];
}

export async function updateConfig(
  config_key: string,
  config_value: string,
): Promise<Config | undefined> {
  const result = await db
    .update(configs)
    .set({ config_value })
    .where(eq(configs.config_key, config_key))
    .returning();
  return result[0];
}

export async function setConfig(config_key: string, config_value: string): Promise<Config> {
  const existing = await getConfigByKey(config_key);
  if (existing) {
    const updated = await updateConfig(config_key, config_value);
    return updated!;
  }
  return createConfig({ config_key, config_value });
}

export async function deleteConfig(config_key: string): Promise<boolean> {
  const result = await db
    .delete(configs)
    .where(eq(configs.config_key, config_key))
    .returning();
  return result.length > 0;
}
