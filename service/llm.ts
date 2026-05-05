import { getConfigValue } from "./configs";
import type { CompressedImportImage } from "./images";
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

type ResponseApiResponse = {
  output_text?: string;
  output?: {
    content?: {
      text?: string;
      type?: string;
    }[];
  }[];
};

export type LlmInputText = {
  type: "input_text";
  text: string;
};

export type LlmInputImage = {
  type: "input_image";
  image_url: string;
  detail: "auto" | "low" | "high";
};

export type LlmInputMessage = {
  role: "system" | "user";
  content: (LlmInputText | LlmInputImage)[];
};

const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_LLM_MODEL = "gpt-4.1-mini";
const SYSTEM_PROMPT =
  "你从支付记录列表截图中提取交易。直接阅读图片内容，按列表顺序识别商户/说明、日期时间和金额。只输出 JSON，不要解释。不要输出分类。金额始终输出正数，收支方向用 0 表示支出、1 表示收入。不确定或缺关键字段的记录不要输出。多张图片可能包含连续记录，也可能有重复记录，重复记录只输出一次。";

export type LlmDebugRequest = {
  apiUrl: string;
  model: string;
  input?: LlmInputMessage[];
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
    apiUrl: apiUrl ?? `${baseUrl.replace(/\/+$/, "")}/responses`,
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

function buildImageTransactionInput(images: CompressedImportImage[]): LlmInputMessage[] {
  return [
    {
      role: "system",
      content: [{ type: "input_text", text: SYSTEM_PROMPT }],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            "输出 JSON 格式：{\"transactions\":[{\"occurred_at\":\"ISO 8601 时间\",\"transaction_type\":0,\"amount\":\"28.50\",\"description\":\"交易摘要或 null\"}]}\n\n请从下面的支付记录截图中提取所有有效交易。",
        },
        ...images.map((image): LlmInputImage => ({
          type: "input_image",
          image_url: image.dataUrl,
          detail: "auto",
        })),
      ],
    },
  ];
}

function redactImageInput(input: LlmInputMessage[]): LlmInputMessage[] {
  return input.map((message) => ({
    ...message,
    content: message.content.map((item) => {
      if (item.type !== "input_image") {
        return item;
      }

      return {
        ...item,
        image_url: item.image_url.replace(/base64,.+$/s, "base64,[redacted]"),
      };
    }),
  }));
}

function getResponseText(data: ResponseApiResponse): string | undefined {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => typeof text === "string" && text.length > 0);
}

export async function parseTransactionsFromImagesWithDebug(
  images: CompressedImportImage[],
): Promise<LlmParseDebugResult> {
  if (images.length === 0) {
    throw new Error("No images selected for LLM parsing.");
  }

  const { apiKey, apiUrl, model } = await getLlmSettings();
  const input = buildImageTransactionInput(images);
  const body = {
    model,
    input,
    text: {
      format: { type: "json_object" },
    },
  };
  const debugInput = redactImageInput(input);
  const debugBody = {
    ...body,
    input: debugInput,
  };

  console.log("[x-ledger] LLM image transaction parse request", {
    apiUrl,
    model,
    input: debugInput,
    body: debugBody,
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

  const data = (await response.json()) as ResponseApiResponse;
  const content = getResponseText(data);
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  console.log("[x-ledger] LLM image transaction parse response", content);

  return {
    transactions: normalizePayload(extractJsonObject(content)),
    request: {
      apiUrl,
      model,
      input: debugInput,
      body: debugBody,
    },
    responseContent: content,
  };
}

export async function parseTransactionsFromImages(
  images: CompressedImportImage[],
): Promise<ParsedTransaction[]> {
  const result = await parseTransactionsFromImagesWithDebug(images);
  return result.transactions;
}
