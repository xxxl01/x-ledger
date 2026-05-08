import { db } from "@/db/client";
import { transactions, type NewTransaction, type Transaction } from "@/db/schema";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";

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
  options?: { allowDuplicate?: boolean; duplicateKeySuffix?: string },
): Promise<Transaction | undefined> {
  const dedupeKey = createTransactionDedupeKey(data);
  const values = {
    ...data,
    dedupe_key: options?.allowDuplicate
      ? `${dedupeKey}_manual_${options.duplicateKeySuffix ?? Date.now()}`
      : dedupeKey,
  };

  const insert = db
    .insert(transactions)
    .values(values);

  const result = options?.allowDuplicate
    ? await insert.returning()
    : await insert.onConflictDoNothing({ target: transactions.dedupe_key }).returning();

  return result[0];
}

export async function createSelectedTransactionsAllowingDuplicates(
  data: (CreateTransactionInput & { isDuplicate?: boolean })[],
): Promise<{
  created: Transaction[];
}> {
  const created: Transaction[] = [];

  for (const [index, item] of data.entries()) {
    const transactionData: CreateTransactionInput = {
      transaction_type: item.transaction_type,
      amount: item.amount,
      occurred_at: item.occurred_at,
      description: item.description,
      category_id: item.category_id,
    };
    const duplicateKeySuffix = `${Date.now()}_${index}`;
    let transaction = await createTransaction(transactionData, {
      allowDuplicate: item.isDuplicate,
      duplicateKeySuffix,
    });
    if (!transaction) {
      transaction = await createTransaction(transactionData, {
        allowDuplicate: true,
        duplicateKeySuffix,
      });
    }

    if (transaction) {
      created.push(transaction);
    }
  }

  return {
    created,
  };
}

export async function getExistingTransactionDedupeKeys(
  data: CreateTransactionInput[],
): Promise<Set<string>> {
  const keys = Array.from(new Set(data.map(createTransactionDedupeKey)));
  if (keys.length === 0) {
    return new Set();
  }

  const result = await db
    .select({ dedupe_key: transactions.dedupe_key })
    .from(transactions)
    .where(inArray(transactions.dedupe_key, keys));

  return new Set(result.map((item) => item.dedupe_key));
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
