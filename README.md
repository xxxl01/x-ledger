<p align="center">
  <img src="assets/images/icon.png" alt="X Ledger Logo" width="120" />
</p>

<h1 align="center">X Ledger</h1>

<p align="center">
  <strong>一个基于 Expo 和 React Native 的本地优先记账应用</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-54-blue" alt="Expo 54" />
  <img src="https://img.shields.io/badge/React%20Native-0.81-61DAFB" alt="React Native 0.81" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-None-lightgrey" alt="License" />
</p>

<p align="center">
  <a href="#features">功能特性</a> ·
  <a href="#tech-stack">技术栈</a> ·
  <a href="#getting-started">快速开始</a> ·
  <a href="#contributing">参与贡献</a>
</p>

---

X Ledger 面向个人日常收支管理，支持按月查看流水、维护资产账户、管理分类，并通过可配置的 LLM 接口从支付记录截图中提取交易候选项，确认后写入本地账本。

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

Screenshot import requires an OpenAI-compatible Responses API endpoint. You can configure it in the app from **Settings → LLM 配置**.

**Default values:**

| 配置项 | 默认值 |
|--------|--------|
| Base URL | `https://api.openai.com/v1` |
| Model | `gpt-4.1-mini` |

**环境变量**（当应用内配置未设置时生效）：

| 变量名 | 说明 |
|--------|------|
| `EXPO_PUBLIC_LLM_API_KEY` | API 密钥 |
| `EXPO_PUBLIC_LLM_BASE_URL` | 基础 URL |
| `EXPO_PUBLIC_LLM_API_URL` | API URL |
| `EXPO_PUBLIC_LLM_MODEL` | 模型名称 |

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

| 表名 | 说明 |
|------|------|
| `transactions` | 收支记录，`transaction_type` 用 `0` 表示支出，`1` 表示收入 |
| `assets` | 资产账户及余额 |
| `categories` | 交易分类 |
| `configs` | 本地键值配置，包括 LLM 设置 |

Database schema changes are tracked through Drizzle migrations under `db/drizzle`.

## Development Notes

- `db/client.ts` owns the global SQLite / Drizzle database instance.
- Service modules in `service/` expose business-oriented functions and are re-exported from `service/index.ts`.
- Screenshot import compresses selected images before sending them to the configured LLM endpoint.
- Imported transactions use a dedupe key to avoid saving duplicate records.

## Roadmap

- [ ] Improve transaction editing and manual entry workflows.
- [ ] Add richer monthly and category analytics.
- [ ] Add tests around import parsing, deduplication, and data services.
- [ ] Polish release configuration and documentation before public distribution.

## Contributing

Issues and pull requests are welcome. For code changes, keep patches focused, run lint before submitting, and update this README when behavior or setup changes.

## License

No license has been published yet. Please contact the project owner before reusing the code outside this repository.
