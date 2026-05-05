import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Circle,
  ImagePlus,
  LoaderCircle,
  Square,
  SquareCheckBig,
} from "lucide-react-native";
import { useMemo, useState } from "react";

import { ThemedText } from "@/components/themed-text";
import {
  parseTransactionsFromOcrTextWithDebug,
  recognizePaymentScreenshot,
  saveImportCandidates,
  type ImportCandidate,
  type LlmDebugRequest,
} from "@/service";

type StepKey = "pick" | "ocr" | "llm" | "review" | "saving";
type StepStatus = "pending" | "active" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "pick", label: "选择截图" },
  { key: "ocr", label: "识别文字" },
  { key: "llm", label: "整理记录" },
  { key: "review", label: "筛选结果" },
];

function formatDay(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatMoney(transaction: ImportCandidate) {
  const prefix = transaction.transaction_type === 1 ? "+" : "-";
  return `${prefix}¥${Number(transaction.amount).toFixed(2)}`;
}

function getStepStatus(currentStep: StepKey, step: StepKey): StepStatus {
  const currentIndex = STEPS.findIndex((item) => item.key === currentStep);
  const stepIndex = STEPS.findIndex((item) => item.key === step);

  if (stepIndex < currentIndex) {
    return "done";
  }
  if (stepIndex === currentIndex) {
    return "active";
  }
  return "pending";
}

export default function UploadScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepKey>("pick");
  const [isWorking, setIsWorking] = useState(false);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [ocrText, setOcrText] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [llmRequest, setLlmRequest] = useState<LlmDebugRequest | null>(null);
  const [llmResponse, setLlmResponse] = useState("");
  const [debugVisible, setDebugVisible] = useState(false);

  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, { index: number; candidate: ImportCandidate }[]>();

    candidates.forEach((candidate, index) => {
      const day = formatDay(candidate.occurred_at);
      const rows = groups.get(day) ?? [];
      rows.push({ index, candidate });
      groups.set(day, rows);
    });

    return Array.from(groups.entries());
  }, [candidates]);

  const selectedCount = selectedIndexes.size;

  async function handleSelectImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要权限", "请允许访问相册后再上传支付记录截图");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setCandidates([]);
    setSelectedIndexes(new Set());
    setOcrText("");
    setRawOcrText("");
    setLlmRequest(null);
    setLlmResponse("");
    setDebugVisible(false);
    setIsWorking(true);

    try {
      setCurrentStep("ocr");
      const ocr = await recognizePaymentScreenshot(result.assets[0].uri);
      console.log("[x-ledger] OCR layout text", ocr.text);
      console.log("[x-ledger] OCR raw text", ocr.rawText);
      setOcrText(ocr.text);
      setRawOcrText(ocr.rawText);
      setCurrentStep("llm");
      const debugResult = ocr.text ? await parseTransactionsFromOcrTextWithDebug(ocr.text) : null;
      setLlmRequest(debugResult?.request ?? null);
      setLlmResponse(debugResult?.responseContent ?? "");
      const nextCandidates: ImportCandidate[] = (debugResult?.transactions ?? []).map((transaction) => ({
        ...transaction,
        category_id: null,
      }));
      setCandidates(nextCandidates);
      setSelectedIndexes(new Set(nextCandidates.map((_, index) => index)));
      setCurrentStep("review");

      if (nextCandidates.length === 0) {
        Alert.alert("没有可导入记录", "这张截图没有识别出有效支付记录");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("识别失败", error instanceof Error ? error.message : "无法识别这张截图");
      setCurrentStep("pick");
    } finally {
      setIsWorking(false);
    }
  }

  function toggleCandidate(index: number) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleDay(indexes: number[]) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      const allSelected = indexes.every((index) => next.has(index));

      for (const index of indexes) {
        if (allSelected) {
          next.delete(index);
        } else {
          next.add(index);
        }
      }

      return next;
    });
  }

  async function handleConfirmImport() {
    const selected = candidates.filter((_, index) => selectedIndexes.has(index));
    if (selected.length === 0) {
      Alert.alert("未选择记录", "请至少选择一条记录再入库");
      return;
    }

    setIsWorking(true);
    setCurrentStep("saving");

    try {
      const result = await saveImportCandidates(selected);
      Alert.alert("导入完成", `已导入 ${result.imported} 条，跳过 ${result.duplicates} 条重复`, [
        { text: "回到账本", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("入库失败", error instanceof Error ? error.message : "无法保存记录");
      setCurrentStep("review");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#11181C" />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText type="title" style={styles.title}>
            导入
          </ThemedText>
          <ThemedText style={styles.subtitle}>识别支付记录，筛选后再入库</ThemedText>
        </View>
        <Pressable disabled={isWorking} style={styles.backButton} onPress={handleSelectImage}>
          <ImagePlus size={20} color="#11181C" />
        </Pressable>
      </View>

      <View style={styles.progressCard}>
        {STEPS.map((step) => {
          const status = currentStep === "saving" && step.key === "review" ? "done" : getStepStatus(currentStep, step.key);
          return (
            <View key={step.key} style={styles.stepRow}>
              {status === "done" ? (
                <Check size={18} color="#1F7A45" />
              ) : status === "active" ? (
                <LoaderCircle size={18} color="#0A7EA4" />
              ) : (
                <Circle size={18} color="#94A3B8" />
              )}
              <ThemedText style={[styles.stepText, status === "active" ? styles.activeStepText : undefined]}>
                {step.label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {currentStep === "pick" ? (
        <View style={styles.pickPanel}>
          <Pressable disabled={isWorking} style={styles.selectButton} onPress={handleSelectImage}>
            <ImagePlus size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>选择支付记录截图</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {isWorking && currentStep !== "review" ? (
        <View style={styles.workingPanel}>
          <ActivityIndicator color="#0A7EA4" />
          <ThemedText style={styles.subtitle}>
            {currentStep === "saving" ? "正在写入账本" : "正在识别，请稍候"}
          </ThemedText>
        </View>
      ) : null}

      {currentStep === "review" ? (
        <>
          <View style={styles.reviewHeader}>
            <ThemedText type="defaultSemiBold">
              已选 {selectedCount} / {candidates.length} 条
            </ThemedText>
            <Pressable disabled={isWorking} style={styles.secondaryButton} onPress={handleSelectImage}>
              <ThemedText style={styles.secondaryButtonText}>重新选择</ThemedText>
            </Pressable>
          </View>

          <Pressable style={styles.debugHeader} onPress={() => setDebugVisible((value) => !value)}>
            <ThemedText type="defaultSemiBold" style={styles.debugTitle}>
              调试信息
            </ThemedText>
            {debugVisible ? (
              <ChevronUp size={18} color="#687076" />
            ) : (
              <ChevronDown size={18} color="#687076" />
            )}
          </Pressable>

          {debugVisible ? (
            <ScrollView style={styles.debugPanel} contentContainerStyle={styles.debugContent}>
              <ThemedText type="defaultSemiBold" style={styles.debugSectionTitle}>
                OCR 重排文本
              </ThemedText>
              <ThemedText selectable style={styles.debugText}>
                {ocrText || "(empty)"}
              </ThemedText>

              <ThemedText type="defaultSemiBold" style={styles.debugSectionTitle}>
                OCR 原始全文
              </ThemedText>
              <ThemedText selectable style={styles.debugText}>
                {rawOcrText || "(empty)"}
              </ThemedText>

              <ThemedText type="defaultSemiBold" style={styles.debugSectionTitle}>
                发送 Prompt
              </ThemedText>
              <ThemedText selectable style={styles.debugText}>
                {llmRequest
                  ? llmRequest.messages
                      .map((message) => `${message.role.toUpperCase()}\n${message.content}`)
                      .join("\n\n---\n\n")
                  : "(empty)"}
              </ThemedText>

              <ThemedText type="defaultSemiBold" style={styles.debugSectionTitle}>
                LLM 响应
              </ThemedText>
              <ThemedText selectable style={styles.debugText}>
                {llmResponse || "(empty)"}
              </ThemedText>
            </ScrollView>
          ) : null}

          <ScrollView contentContainerStyle={styles.listContent}>
            {groupedCandidates.map(([day, rows]) => (
              <View key={day} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <ThemedText style={styles.dayTitle}>{day}</ThemedText>
                  <Pressable onPress={() => toggleDay(rows.map((row) => row.index))} style={styles.dayButton}>
                    <ThemedText style={styles.dayButtonText}>
                      {rows.every((row) => selectedIndexes.has(row.index)) ? "取消当天" : "选中当天"}
                    </ThemedText>
                  </Pressable>
                </View>
                {rows.map(({ index, candidate }) => {
                  const selected = selectedIndexes.has(index);
                  return (
                    <Pressable
                      key={`${candidate.occurred_at}-${candidate.amount}-${index}`}
                      onPress={() => toggleCandidate(index)}
                      style={[styles.recordRow, selected ? styles.selectedRecordRow : undefined]}>
                      {selected ? (
                        <SquareCheckBig size={20} color="#0A7EA4" />
                      ) : (
                        <Square size={20} color="#94A3B8" />
                      )}
                      <View style={styles.recordMain}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                          {candidate.description || "未命名记录"}
                        </ThemedText>
                        <ThemedText style={styles.mutedText}>{formatTime(candidate.occurred_at)}</ThemedText>
                      </View>
                      <ThemedText style={candidate.transaction_type === 1 ? styles.incomeText : styles.expenseText}>
                        {formatMoney(candidate)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable disabled={isWorking} style={styles.primaryButton} onPress={handleConfirmImport}>
              <Check size={20} color="#FFFFFF" />
              <ThemedText style={styles.primaryButtonText}>确定入库</ThemedText>
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
  },
  subtitle: {
    color: "#687076",
    fontSize: 13,
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 16,
    padding: 12,
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  stepText: {
    color: "#687076",
    fontSize: 14,
  },
  activeStepText: {
    color: "#0A7EA4",
    fontWeight: "700",
  },
  pickPanel: {
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  workingPanel: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    padding: 28,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  debugHeader: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  debugTitle: {
    fontSize: 14,
  },
  debugPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 6,
    maxHeight: 260,
  },
  debugContent: {
    gap: 8,
    padding: 10,
  },
  debugSectionTitle: {
    fontSize: 13,
  },
  debugText: {
    color: "#475569",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 17,
  },
  listContent: {
    gap: 12,
    padding: 12,
    paddingBottom: 76,
  },
  dayGroup: {
    gap: 6,
  },
  dayHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayTitle: {
    color: "#687076",
    fontSize: 14,
    fontWeight: "700",
  },
  dayButton: {
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recordRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedRecordRow: {
    borderColor: "#0A7EA4",
  },
  recordMain: {
    flex: 1,
    gap: 1,
  },
  mutedText: {
    color: "#687076",
    fontSize: 12,
  },
  expenseText: {
    color: "#A6423A",
    fontSize: 15,
    fontWeight: "800",
  },
  incomeText: {
    color: "#1F7A45",
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    backgroundColor: "#F7F8FA",
    borderTopColor: "#E3E6EA",
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
  },
});
