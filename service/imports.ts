import { parseTransactionsFromOcrText } from "./llm";
import { recognizePaymentScreenshot } from "./ocr";
import { createTransactions, type CreateTransactionInput } from "./transactions";

export type ImportCandidate = CreateTransactionInput;

export type ScreenshotImportResult = {
  imported: number;
  duplicates: number;
  selected: number;
};

export async function analyzePaymentScreenshot(imageUri: string): Promise<ImportCandidate[]> {
  const ocr = await recognizePaymentScreenshot(imageUri);
  if (!ocr.text) {
    return [];
  }

  const parsed = await parseTransactionsFromOcrText(ocr.text);
  return parsed.map((transaction) => ({
    ...transaction,
    category_id: null,
  }));
}

export async function saveImportCandidates(
  candidates: ImportCandidate[],
): Promise<ScreenshotImportResult> {
  const result = await createTransactions(candidates);

  return {
    imported: result.created.length,
    duplicates: result.duplicates,
    selected: candidates.length,
  };
}

export async function importPaymentScreenshot(
  imageUri: string,
): Promise<ScreenshotImportResult> {
  const candidates = await analyzePaymentScreenshot(imageUri);
  if (candidates.length === 0) {
    return {
      imported: 0,
      duplicates: 0,
      selected: 0,
    };
  }

  return saveImportCandidates(candidates);
}
