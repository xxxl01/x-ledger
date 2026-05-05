import { db } from "@/db/client";
import { assets, type Asset, type NewAsset } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function createAsset(data: NewAsset): Promise<Asset> {
  const result = await db.insert(assets).values(data).returning();
  return result[0];
}

export async function getAssetById(asset_id: number): Promise<Asset | undefined> {
  const result = await db.select().from(assets).where(eq(assets.asset_id, asset_id));
  return result[0];
}

export async function getAllAssets(): Promise<Asset[]> {
  return db.select().from(assets).orderBy(desc(assets.asset_id));
}

export async function updateAsset(
  asset_id: number,
  data: Partial<NewAsset>,
): Promise<Asset | undefined> {
  const result = await db
    .update(assets)
    .set(data)
    .where(eq(assets.asset_id, asset_id))
    .returning();
  return result[0];
}

export async function updateAssetAmount(
  asset_id: number,
  amount: NewAsset["amount"],
): Promise<Asset | undefined> {
  return updateAsset(asset_id, { amount });
}

export async function deleteAsset(asset_id: number): Promise<boolean> {
  const result = await db.delete(assets).where(eq(assets.asset_id, asset_id)).returning();
  return result.length > 0;
}
