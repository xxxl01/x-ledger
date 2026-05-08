import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ChevronLeft,
  Circle,
  ImagePlus,
  LoaderCircle,
  Square,
  SquareCheckBig,
  X,
} from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";

import { ThemedText } from "@/components/themed-text";
import {
  compressImagesForLlm,
  markImportCandidateDuplicates,
  parseTransactionsFromImagesWithDebug,
  saveImportCandidates,
  type ImportCandidateWithDuplicateFlag,
} from "@/service";

type StepKey = "pick" | "ready" | "compress" | "llm" | "review" | "saving";
type StepStatus = "pending" | "active" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "pick", label: "选择截图" },
  { key: "compress", label: "压缩图片" },
  { key: "llm", label: "整理记录" },
  { key: "review", label: "筛选结果" },
];

type SelectedImage = {
  uri: string;
  width?: number;
  height?: number;
};

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

function formatMoney(transaction: ImportCandidateWithDuplicateFlag) {
  const prefix = transaction.transaction_type === 1 ? "+" : "-";
  return `${prefix}¥${Number(transaction.amount).toFixed(2)}`;
}

function getStepStatus(currentStep: StepKey, step: StepKey): StepStatus {
  if (currentStep === "ready") {
    return step === "pick" ? "done" : "pending";
  }

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
  const [transactionYear, setTransactionYear] = useState(() => String(new Date().getFullYear()));
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [candidates, setCandidates] = useState<ImportCandidateWithDuplicateFlag[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, { index: number; candidate: ImportCandidateWithDuplicateFlag }[]>();

    candidates.forEach((candidate, index) => {
      const day = formatDay(candidate.occurred_at);
      const rows = groups.get(day) ?? [];
      rows.push({ index, candidate });
      groups.set(day, rows);
    });

    return Array.from(groups.entries());
  }, [candidates]);

  const selectedCount = selectedIndexes.size;
  const duplicateCount = useMemo(
    () => candidates.filter((candidate) => candidate.isDuplicate).length,
    [candidates],
  );
  const selectedDuplicateCount = useMemo(
    () => candidates.filter((candidate, index) => candidate.isDuplicate && selectedIndexes.has(index)).length,
    [candidates, selectedIndexes],
  );

  const resetRecognitionResult = useCallback(() => {
    setCandidates([]);
    setSelectedIndexes(new Set());
  }, []);

  async function handleSelectImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要权限", "请允许访问相册后再上传支付记录截图");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    resetRecognitionResult();
    setSelectedImages(
      result.assets
        .filter((asset) => Boolean(asset.uri))
        .map((asset) => ({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        })),
    );
    setCurrentStep("ready");
  }

  const removeSelectedImage = useCallback((uri: string) => {
    setSelectedImages((current) => {
      const next = current.filter((image) => image.uri !== uri);
      if (next.length === 0) {
        setCurrentStep("pick");
      } else {
        setCurrentStep("ready");
      }
      return next;
    });
    resetRecognitionResult();
  }, [resetRecognitionResult]);

  async function handleStartRecognition() {
    const recognitionYear = transactionYear.trim();
    if (!/^\d{4}$/.test(recognitionYear)) {
      Alert.alert("年份无效", "请输入 4 位年份");
      return;
    }

    if (selectedImages.length === 0) {
      Alert.alert("未选择图片", "请先选择支付记录截图");
      return;
    }

    resetRecognitionResult();
    setIsWorking(true);

    try {
      setCurrentStep("compress");
      const compressed = await compressImagesForLlm(selectedImages.map((image) => image.uri));
      setCurrentStep("llm");
      const parseResult = await parseTransactionsFromImagesWithDebug(compressed, {
        transactionYear: recognitionYear,
      });
      const parsedCandidates = parseResult.transactions.map((transaction) => ({
        ...transaction,
        category_id: null,
      }));
      const nextCandidates = await markImportCandidateDuplicates(parsedCandidates);
      setCandidates(nextCandidates);
      setSelectedIndexes(new Set(nextCandidates.map((_, index) => index)));
      setCurrentStep("review");

      if (nextCandidates.length === 0) {
        Alert.alert("没有可导入记录", "这些截图没有识别出有效支付记录");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("识别失败", error instanceof Error ? error.message : "无法识别这些截图");
      setCurrentStep("ready");
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
      Alert.alert("导入完成", `已导入 ${result.imported} / ${result.selected} 条`, [
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
          <ThemedText style={styles.subtitle}>选择支付记录截图，确认后再识别入库</ThemedText>
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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imagePanel}>
          <View style={styles.imagePanelHeader}>
            <ThemedText type="defaultSemiBold" style={styles.imagePanelTitle}>
              {selectedImages.length > 0 ? `已选择 ${selectedImages.length} 张截图` : "支付记录截图"}
            </ThemedText>
            <View style={styles.imageHeaderActions}>
              <TextInput
                value={transactionYear}
                onChangeText={setTransactionYear}
                editable={!isWorking}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="年份"
                style={styles.yearInput}
              />
              {selectedImages.length > 0 ? (
                <Pressable disabled={isWorking} style={styles.secondaryButton} onPress={handleSelectImage}>
                  <ThemedText style={styles.secondaryButtonText}>重新选择</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {selectedImages.length > 0 ? (
            <SelectedImageGrid images={selectedImages} onRemove={removeSelectedImage} />
          ) : (
            <View style={styles.emptyImagePanel}>
              <Pressable disabled={isWorking} style={styles.selectButton} onPress={handleSelectImage}>
                <ImagePlus size={20} color="#FFFFFF" />
                <ThemedText style={styles.primaryButtonText}>选择支付记录截图</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {isWorking && currentStep !== "review" ? (
          <View style={styles.workingPanel}>
            <ActivityIndicator color="#0A7EA4" />
            <ThemedText style={styles.subtitle}>
              {currentStep === "saving"
                ? "正在写入账本"
                : currentStep === "compress"
                  ? "正在压缩图片"
                  : "正在识别，请稍候"}
            </ThemedText>
          </View>
        ) : null}

        {currentStep === "review" ? (
          <View style={styles.reviewContent}>
            <View style={styles.reviewHeader}>
              <ThemedText type="defaultSemiBold">
                已选 {selectedCount} / {candidates.length} 条
              </ThemedText>
              {duplicateCount > 0 ? (
                <ThemedText style={styles.duplicateSummary}>
                  重复 {selectedDuplicateCount} / {duplicateCount} 条
                </ThemedText>
              ) : null}
            </View>

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
                  const textStyle = candidate.isDuplicate ? styles.duplicateText : undefined;
                  return (
                    <Pressable
                      key={`${candidate.occurred_at}-${candidate.amount}-${index}`}
                      onPress={() => toggleCandidate(index)}
                      style={[
                        styles.recordRow,
                        selected ? styles.selectedRecordRow : undefined,
                        candidate.isDuplicate ? styles.duplicateRecordRow : undefined,
                      ]}>
                      {selected ? (
                        <SquareCheckBig size={20} color={candidate.isDuplicate ? "#C2410C" : "#0A7EA4"} />
                      ) : (
                        <Square size={20} color={candidate.isDuplicate ? "#C2410C" : "#94A3B8"} />
                      )}
                      <View style={styles.recordMain}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1} style={textStyle}>
                          {candidate.description || "未命名记录"}
                        </ThemedText>
                        <ThemedText style={[styles.mutedText, textStyle]}>
                          {formatTime(candidate.occurred_at)}
                          {candidate.isDuplicate ? " · 重复" : ""}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          candidate.transaction_type === 1 ? styles.incomeText : styles.expenseText,
                          textStyle,
                        ]}>
                        {formatMoney(candidate)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {currentStep === "ready" ? (
        <View style={styles.footer}>
          <Pressable disabled={isWorking} style={styles.primaryButton} onPress={handleStartRecognition}>
            <LoaderCircle size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>开始识别</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {currentStep === "review" ? (
          <View style={styles.footer}>
            <Pressable disabled={isWorking} style={styles.primaryButton} onPress={handleConfirmImport}>
              <Check size={20} color="#FFFFFF" />
              <ThemedText style={styles.primaryButtonText}>确定入库</ThemedText>
            </Pressable>
          </View>
      ) : null}
    </SafeAreaView>
  );
}

const SelectedImageGrid = memo(function SelectedImageGrid({
  images,
  onRemove,
}: {
  images: SelectedImage[];
  onRemove: (uri: string) => void;
}) {
  const { width } = useWindowDimensions();
  const imageSize = Math.floor((width - 24 - 16) / 3);

  return (
    <View style={styles.imageGrid}>
      {images.map((image, index) => (
        <View key={`${image.uri}-${index}`} style={[styles.imageCard, { height: imageSize, width: imageSize }]}>
          <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
          <Pressable
            accessibilityLabel="移除图片"
            style={styles.removeImageButton}
            onPress={() => onRemove(image.uri)}>
            <X size={16} color="#11181C" />
          </Pressable>
        </View>
      ))}
    </View>
  );
});

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
  content: {
    paddingBottom: 76,
  },
  imagePanel: {
    marginHorizontal: 12,
    marginTop: 10,
  },
  imagePanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 44,
  },
  imagePanelTitle: {
    flex: 1,
  },
  imageHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  yearInput: {
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#11181C",
    fontSize: 13,
    fontWeight: "700",
    height: 34,
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlign: "center",
    width: 58,
  },
  emptyImagePanel: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    padding: 12,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageCard: {
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  removeImageButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderColor: "#D8DDE3",
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 28,
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
    paddingHorizontal: 4,
  },
  duplicateSummary: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "700",
  },
  reviewContent: {
    gap: 12,
    padding: 12,
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
  duplicateRecordRow: {
    borderColor: "#F97316",
  },
  recordMain: {
    flex: 1,
    gap: 1,
  },
  duplicateText: {
    color: "#C2410C",
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
