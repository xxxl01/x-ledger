import { getConfigValue } from "./configs";
import { TransactionType, type TransactionTypeValue } from "./transactions";

export type ParsedTransaction = {
  occurred_at: string;
  transaction_type: TransactionTypeValue;
  amount: string;
  description: string | null;
};

type LlmTransactionPayload = {
  transactions?: {
    occurred_at?: unknown;
    transaction_type?: unknown;
    amount?: unknown;
    description?: unknown;
  }[];
};

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_LLM_MODEL = "gpt-4.1-mini";
const SYSTEM_PROMPT =
  "你从支付记录列表截图的 OCR 文本中提取交易。OCR 文本已按屏幕坐标重排：每一行对应截图中的一条水平文本行，竖线 | 表示同一水平行中的左右列。相邻的商户/说明、日期时间、金额可能属于同一条交易，需要按列表顺序合并。只输出 JSON，不要解释。不要输出分类。金额始终输出正数，收支方向用 0 表示支出、1 表示收入。不确定或缺关键字段的记录不要输出。";

export type LlmDebugRequest = {
  apiUrl: string;
  model: string;
  messages: {
    role: "system" | "user";
    content: string;
  }[];
  body: unknown;
};

export type LlmParseDebugResult = {
  transactions: ParsedTransaction[];
  request: LlmDebugRequest;
  responseContent: string;
};

function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

async function getLlmSettings() {
  const apiKey =
    (await getConfigValue("llm_api_key")) ?? getEnvValue("EXPO_PUBLIC_LLM_API_KEY");
  const baseUrl =
    (await getConfigValue("llm_base_url")) ??
    getEnvValue("EXPO_PUBLIC_LLM_BASE_URL") ??
    DEFAULT_LLM_BASE_URL;
  const apiUrl =
    (await getConfigValue("llm_api_url")) ?? getEnvValue("EXPO_PUBLIC_LLM_API_URL");
  const model =
    (await getConfigValue("llm_model")) ??
    getEnvValue("EXPO_PUBLIC_LLM_MODEL") ??
    DEFAULT_LLM_MODEL;

  if (!apiKey) {
    throw new Error("Missing LLM API key. Set llm_api_key or EXPO_PUBLIC_LLM_API_KEY.");
  }

  return {
    apiKey,
    apiUrl: apiUrl ?? `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
    model,
  };
}

function extractJsonObject(content: string): LlmTransactionPayload {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonText) as LlmTransactionPayload;
}

function normalizeAmount(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const amount = Math.abs(Number(String(value).replace(/[^\d.-]/g, "")));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount.toFixed(2);
}

function normalizeOccurredAt(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeTransactionType(value: unknown): TransactionTypeValue | null {
  if (value === TransactionType.Expense || value === "expense" || value === "支出") {
    return TransactionType.Expense;
  }

  if (value === TransactionType.Income || value === "income" || value === "收入") {
    return TransactionType.Income;
  }

  return null;
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const description = value.trim();
  return description.length > 0 ? description : null;
}

function normalizePayload(payload: LlmTransactionPayload): ParsedTransaction[] {
  const rows = Array.isArray(payload.transactions) ? payload.transactions : [];
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const occurred_at = normalizeOccurredAt(row.occurred_at);
    const transaction_type = normalizeTransactionType(row.transaction_type);
    const amount = normalizeAmount(row.amount);

    if (!occurred_at || transaction_type === null || !amount) {
      continue;
    }

    transactions.push({
      occurred_at,
      transaction_type,
      amount,
      description: normalizeDescription(row.description),
    });
  }

  return transactions;
}

export function buildTransactionParseMessages(ocrText: string): LlmDebugRequest["messages"] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `输出格式：{"transactions":[{"occurred_at":"ISO 8601 时间","transaction_type":0,"amount":"28.50","description":"交易摘要或 null"}]}\n\nOCR 文本：\n${ocrText}`,
    },
  ];
}

export async function parseTransactionsFromOcrTextWithDebug(
  ocrText: string,
): Promise<LlmParseDebugResult> {
  const { apiKey, apiUrl, model } = await getLlmSettings();
  const messages = buildTransactionParseMessages(ocrText);
  const body = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages,
  };

  console.log("[x-ledger] LLM transaction parse request", {
    apiUrl,
    model,
    messages,
    body,
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${message}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  console.log("[x-ledger] LLM transaction parse response", content);

  return {
    transactions: normalizePayload(extractJsonObject(content)),
    request: {
      apiUrl,
      model,
      messages,
      body,
    },
    responseContent: content,
  };
}

export async function parseTransactionsFromOcrText(ocrText: string): Promise<ParsedTransaction[]> {
  const result = await parseTransactionsFromOcrTextWithDebug(ocrText);
  return result.transactions;
}
