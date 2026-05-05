# X Ledger

X Ledger 是一个基于 Expo 和 React Native 的本地优先记账应用。它面向个人日常收支管理，支持按月查看流水、维护资产账户、管理分类，并通过可配置的 LLM 接口从支付记录截图中提取交易候选项，确认后写入本地账本。

> 项目仍在早期迭代中，核心记账、资产、分类和截图导入流程已经具备可运行基础。

## Features

- 按月查看收支流水，支持支出、收入、未分类记录筛选。
- 查看月度支出、收入和结余汇总。
- 编辑或删除单条交易记录，并在编辑时设置分类。
- 管理自定义分类，删除分类时自动解除相关交易关联。
- 管理资产账户和账户余额。
- 从一张或多张支付记录截图中识别交易，人工勾选确认后入库。
- 通过应用内设置配置 LLM Base URL、API Key 和模型。
- 使用本地 SQLite 存储数据，配合 Drizzle ORM 和迁移文件管理 schema。

## Tech Stack

- [Expo](https://expo.dev/) 54
- [React Native](https://reactnative.dev/) 0.81
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [SQLite for Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Drizzle ORM](https://orm.drizzle.team/)
- TypeScript
- LangChain / OpenAI-compatible Responses API for image transaction parsing

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- Expo development environment
- Android Studio or Xcode if you want to run native builds

### Install

```bash
npm install
```

### Run

Start the Expo dev server:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run on web:

```bash
npm run web
```

### Lint

```bash
npm run lint
```

## LLM Configuration

Screenshot import requires an OpenAI-compatible Responses API endpoint. You can configure it in the app from Settings -> LLM 配置.

Default values:

- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4.1-mini`

The service also reads these environment variables when app-level config is not present:

- `EXPO_PUBLIC_LLM_API_KEY`
- `EXPO_PUBLIC_LLM_BASE_URL`
- `EXPO_PUBLIC_LLM_API_URL`
- `EXPO_PUBLIC_LLM_MODEL`

## Project Structure

```text
app/                 Expo Router pages and tab screens
components/          Shared themed UI components
constants/           Theme constants
db/                  SQLite client, Drizzle schema, and migrations
service/             Data access and business services
types/               Type declarations
assets/              App icons and image assets
```

## Data Model

The local database currently contains:

- `transactions`: income and expense records, with `transaction_type` using `0` for expense and `1` for income.
- `assets`: asset accounts and balances.
- `categories`: transaction categories.
- `configs`: local key-value configuration, including LLM settings.

Database schema changes are tracked through Drizzle migrations under `db/drizzle`.

## Development Notes

- `db/client.ts` owns the global SQLite / Drizzle database instance.
- Service modules in `service/` expose business-oriented functions and are re-exported from `service/index.ts`.
- Screenshot import compresses selected images before sending them to the configured LLM endpoint.
- Imported transactions use a dedupe key to avoid saving duplicate records.

## Roadmap

- Improve transaction editing and manual entry workflows.
- Add richer monthly and category analytics.
- Add tests around import parsing, deduplication, and data services.
- Polish release configuration and documentation before public distribution.

## Contributing

Issues and pull requests are welcome. For code changes, keep patches focused, run lint before submitting, and update this README when behavior or setup changes.

## License

No license has been published yet. Please contact the project owner before reusing the code outside this repository.
