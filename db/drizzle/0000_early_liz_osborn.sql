CREATE TABLE `assets` (
	`asset_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`amount` numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`category_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_name` text NOT NULL,
	`category_icon` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `configs` (
	`config_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_key` text NOT NULL,
	`config_value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `configs_config_key_unique` ON `configs` (`config_key`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`transaction_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_type` integer NOT NULL,
	`amount` numeric NOT NULL,
	`occurred_at` text NOT NULL,
	`dedupe_key` text NOT NULL,
	CONSTRAINT "transactions_transaction_type_check" CHECK("transactions"."transaction_type" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedupe_key_unique` ON `transactions` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_transactions_occurred_at` ON `transactions` (`occurred_at`);