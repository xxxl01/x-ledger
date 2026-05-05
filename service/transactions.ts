import { db } from "@/db/client";
import { transactions, type NewTransaction, type Transaction } from "@/db/schema";
import { and, desc, eq, gte, lt } from "drizzle-orm";

export const TransactionType = {
  Expense: 0,
  Income: 1,
} as const;

export type TransactionTypeValue = (typeof TransactionType)[keyof typeof TransactionType];

export type CreateTransactionInput = Omit<NewTransaction, "transaction_id" | "dedupe_key">;

export function createTransactionDedupeKey(data: CreateTransactionInput) {
  return `${data.occurred_at}_${data.amount}_${data.transaction_type}`;
}

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<Transaction | undefined> {
  const result = await db
    .insert(transactions)
    .values({
      ...data,
      dedupe_key: createTransactionDedupeKey(data),
    })
    .onConflictDoNothing({ target: transactions.dedupe_key })
    .returning();

  return result[0];
}

export async function createTransactions(data: CreateTransactionInput[]): Promise<{
  created: Transaction[];
  duplicates: number;
}> {
  const created: Transaction[] = [];

  for (const item of data) {
    const transaction = await createTransaction(item);
    if (transaction) {
      created.push(transaction);
    }
  }

  return {
    created,
    duplicates: data.length - created.length,
  };
}

export async function getTransactionById(
  transaction_id: number,
): Promise<Transaction | undefined> {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.transaction_id, transaction_id));
  return result[0];
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.occurred_at), desc(transactions.transaction_id));
}

export async function getTransactionsByDateRange(
  startAt: string,
  endAt: string,
): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .where(and(gte(transactions.occurred_at, startAt), lt(transactions.occurred_at, endAt)))
    .orderBy(desc(transactions.occurred_at), desc(transactions.transaction_id));
}

export async function getTransactionsByMonth(year: number, month: number): Promise<Transaction[]> {
  const startAt = new Date(year, month - 1, 1).toISOString();
  const endAt = new Date(year, month, 1).toISOString();
  return getTransactionsByDateRange(startAt, endAt);
}

export async function updateTransaction(
  transaction_id: number,
  data: Partial<CreateTransactionInput>,
): Promise<Transaction | undefined> {
  const existing = await getTransactionById(transaction_id);
  if (!existing) {
    return undefined;
  }

  const next = {
    transaction_type: data.transaction_type ?? existing.transaction_type,
    amount: data.amount ?? existing.amount,
    occurred_at: data.occurred_at ?? existing.occurred_at,
    description: data.description ?? existing.description,
    category_id: data.category_id ?? existing.category_id,
  };

  const result = await db
    .update(transactions)
    .set({
      ...data,
      dedupe_key: createTransactionDedupeKey(next),
    })
    .where(eq(transactions.transaction_id, transaction_id))
    .returning();

  return result[0];
}

export async function clearTransactionCategory(category_id: number): Promise<number> {
  const result = await db
    .update(transactions)
    .set({ category_id: null })
    .where(eq(transactions.category_id, category_id))
    .returning();
  return result.length;
}

export async function deleteTransaction(transaction_id: number): Promise<boolean> {
  const result = await db
    .delete(transactions)
    .where(eq(transactions.transaction_id, transaction_id))
    .returning();
  return result.length > 0;
}
