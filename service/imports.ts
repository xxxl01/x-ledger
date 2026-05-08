import { compressImagesForLlm } from "./images";
import { parseTransactionsFromImages, type ParseTransactionsFromImagesOptions } from "./llm";
import {
  createTransactionDedupeKey,
  createSelectedTransactionsAllowingDuplicates,
  getExistingTransactionDedupeKeys,
  type CreateTransactionInput,
} from "./transactions";

export type ImportCandidate = CreateTransactionInput;

export type ImportCandidateWithDuplicateFlag = ImportCandidate & {
  isDuplicate: boolean;
};

export type ScreenshotImportResult = {
  imported: number;
  selected: number;
};

export async function analyzePaymentScreenshots(
  imageUris: string[],
  options?: ParseTransactionsFromImagesOptions,
): Promise<ImportCandidate[]> {
  const images = await compressImagesForLlm(imageUris);
  const parsed = await parseTransactionsFromImages(images, options);
  return parsed.map((transaction) => ({
    ...transaction,
    category_id: null,
  }));
}

export async function analyzePaymentScreenshot(
  imageUri: string,
  options?: ParseTransactionsFromImagesOptions,
): Promise<ImportCandidate[]> {
  return analyzePaymentScreenshots([imageUri], options);
}

export async function markImportCandidateDuplicates(
  candidates: ImportCandidate[],
): Promise<ImportCandidateWithDuplicateFlag[]> {
  const existingKeys = await getExistingTransactionDedupeKeys(candidates);
  const seenKeys = new Set<string>();

  return candidates.map((candidate) => {
    const key = createTransactionDedupeKey(candidate);
    const isDuplicate = existingKeys.has(key) || seenKeys.has(key);
    seenKeys.add(key);
    return {
      ...candidate,
      isDuplicate,
    };
  });
}

export async function saveImportCandidates(
  candidates: ImportCandidateWithDuplicateFlag[],
): Promise<ScreenshotImportResult> {
  const result = await createSelectedTransactionsAllowingDuplicates(candidates);

  return {
    imported: result.created.length,
    selected: candidates.length,
  };
}

export async function importPaymentScreenshot(
  imageUri: string,
  options?: ParseTransactionsFromImagesOptions,
): Promise<ScreenshotImportResult> {
  const candidates = await analyzePaymentScreenshots([imageUri], options);
  if (candidates.length === 0) {
    return {
      imported: 0,
      selected: 0,
    };
  }

  return saveImportCandidates(await markImportCandidateDuplicates(candidates));
}
