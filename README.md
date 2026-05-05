# X Ledger

An Expo bookkeeping app in the initial setup phase.

## Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npx expo start
```

## Current State

- Template demo screens have been removed.
- SQLite support is installed with `expo-sqlite`.
- The app currently contains a minimal ledger home screen.
- Database initialization creates `transactions`, `assets`, `categories`, and `configs`.
- Primary keys use explicit names such as `transaction_id`, `asset_id`, `category_id`, and `config_id`.
- `transactions.transaction_type` uses `0` for expense and `1` for income.
- Database access follows the ImageVideo pattern: `db/client.ts` exports a global Drizzle `db`, and service functions only receive business parameters.
- Database schema changes are managed by Drizzle migrations in `db/drizzle`.
- Table service functions are exported from `service/index.ts`.
