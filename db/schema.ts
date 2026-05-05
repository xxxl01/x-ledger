import { sql } from "drizzle-orm";
import { check, index, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable(
  "transactions",
  {
    transaction_id: integer("transaction_id").primaryKey({ autoIncrement: true }),
    transaction_type: integer("transaction_type").notNull(),
    amount: numeric("amount").notNull(),
    occurred_at: text("occurred_at").notNull(),
    description: text("description"),
    category_id: integer("category_id"),
    dedupe_key: text("dedupe_key").notNull().unique(),
  },
  (table) => ({
    transaction_type_check: check(
      "transactions_transaction_type_check",
      sql`${table.transaction_type} IN (0, 1)`,
    ),
    occurred_at_idx: index("idx_transactions_occurred_at").on(table.occurred_at),
  }),
);

export const assets = sqliteTable("assets", {
  asset_id: integer("asset_id").primaryKey({ autoIncrement: true }),
  account_name: text("account_name").notNull(),
  amount: numeric("amount").notNull().default("0"),
});

export const categories = sqliteTable("categories", {
  category_id: integer("category_id").primaryKey({ autoIncrement: true }),
  category_name: text("category_name").notNull(),
  category_icon: text("category_icon").notNull(),
});

export const configs = sqliteTable("configs", {
  config_id: integer("config_id").primaryKey({ autoIncrement: true }),
  config_key: text("config_key").notNull().unique(),
  config_value: text("config_value").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Config = typeof configs.$inferSelect;
export type NewConfig = typeof configs.$inferInsert;
