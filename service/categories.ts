import { db } from "@/db/client";
import { categories, type Category, type NewCategory } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { clearTransactionCategory } from "./transactions";

export async function createCategory(data: NewCategory): Promise<Category> {
  const result = await db.insert(categories).values(data).returning();
  return result[0];
}

export async function getCategoryById(category_id: number): Promise<Category | undefined> {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.category_id, category_id));
  return result[0];
}

export async function getAllCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(desc(categories.category_id));
}

export async function updateCategory(
  category_id: number,
  data: Partial<NewCategory>,
): Promise<Category | undefined> {
  const result = await db
    .update(categories)
    .set(data)
    .where(eq(categories.category_id, category_id))
    .returning();
  return result[0];
}

export async function deleteCategory(category_id: number): Promise<boolean> {
  const result = await db
    .delete(categories)
    .where(eq(categories.category_id, category_id))
    .returning();
  return result.length > 0;
}

export async function deleteCategoryAndUnassignTransactions(category_id: number): Promise<boolean> {
  await clearTransactionCategory(category_id);
  return deleteCategory(category_id);
}
