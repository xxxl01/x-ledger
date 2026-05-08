import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { Category, Transaction } from "@/db/schema";
import {
  createCategory,
  deleteTransaction,
  getAllCategories,
  getTransactionsByMonth,
  TransactionType,
  updateTransaction,
} from "@/service";

type FilterKey = "all" | "expense" | "income" | "uncategorized";

type EditForm = {
  description: string;
  amount: string;
  occurred_at: string;
  transaction_type: string;
  category_id: string;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "expense", label: "支出" },
  { key: "income", label: "收入" },
  { key: "uncategorized", label: "未分类" },
];

function formatMonth(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDay(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseDateTimeInput(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatMoney(amount: string, transactionType: number) {
  const prefix = transactionType === TransactionType.Income ? "+" : "-";
  return `${prefix}¥${Number(amount).toFixed(2)}`;
}

function getAmountNumber(transaction: Transaction) {
  const value = Number(transaction.amount);
  return Number.isFinite(value) ? value : 0;
}

export default function HomeScreen() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isCreatingEditCategory, setIsCreatingEditCategory] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [categoryPickerWidth, setCategoryPickerWidth] = useState(0);
  const categoryChipWidth = categoryPickerWidth > 0
    ? Math.floor((categoryPickerWidth - 12) / 3)
    : undefined;

  const loadData = useCallback(async () => {
    const [nextTransactions, nextCategories] = await Promise.all([
      getTransactionsByMonth(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
      getAllCategories(),
    ]);
    setTransactions(nextTransactions);
    setCategories(nextCategories);
  }, [currentMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch((error) => {
        console.error(error);
        Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取账本数据");
      });
    }, [loadData]),
  );

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.category_id, category]));
  }, [categories]);

  const monthSummary = useMemo(() => {
    let expense = 0;
    let income = 0;

    for (const transaction of transactions) {
      if (transaction.transaction_type === TransactionType.Income) {
        income += getAmountNumber(transaction);
      } else {
        expense += getAmountNumber(transaction);
      }
    }

    return {
      expense,
      income,
      balance: income - expense,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (filter === "expense") {
        return transaction.transaction_type === TransactionType.Expense;
      }
      if (filter === "income") {
        return transaction.transaction_type === TransactionType.Income;
      }
      if (filter === "uncategorized") {
        return transaction.category_id === null;
      }
      return true;
    });
  }, [filter, transactions]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const transaction of filteredTransactions) {
      const day = formatDay(transaction.occurred_at);
      const dayTransactions = groups.get(day) ?? [];
      dayTransactions.push(transaction);
      groups.set(day, dayTransactions);
    }
    return Array.from(groups.entries());
  }, [filteredTransactions]);

  function shiftMonth(delta: number) {
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + delta, 1));
  }

  function openEditModal(transaction: Transaction) {
    setEditingTransaction(transaction);
    setEditForm({
      description: transaction.description ?? "",
      amount: String(transaction.amount),
      occurred_at: toDateTimeInputValue(transaction.occurred_at),
      transaction_type: String(transaction.transaction_type),
      category_id: transaction.category_id === null ? "" : String(transaction.category_id),
    });
  }

  function closeEditModal() {
    setEditingTransaction(null);
    setEditForm(null);
    setIsCreatingEditCategory(false);
    setEditCategoryName("");
  }

  async function handleSaveTransaction() {
    if (!editingTransaction || !editForm) {
      return;
    }

    const amount = Math.abs(Number(editForm.amount));
    const occurredAt = parseDateTimeInput(editForm.occurred_at);
    const transactionType = Number(editForm.transaction_type);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("金额无效", "请输入大于 0 的金额");
      return;
    }

    if (!occurredAt) {
      Alert.alert("时间无效", "请输入类似 2026-05-04 12:30 的时间");
      return;
    }

    if (transactionType !== TransactionType.Expense && transactionType !== TransactionType.Income) {
      Alert.alert("类型无效", "请选择收入或支出");
      return;
    }

    await updateTransaction(editingTransaction.transaction_id, {
      description: editForm.description.trim() || null,
      amount: amount.toFixed(2),
      occurred_at: occurredAt,
      transaction_type: transactionType,
      category_id: editForm.category_id ? Number(editForm.category_id) : null,
    });

    closeEditModal();
    await loadData();
  }

  async function handleDeleteTransaction() {
    if (!editingTransaction) {
      return;
    }

    await deleteTransaction(editingTransaction.transaction_id);
    closeEditModal();
    await loadData();
  }

  async function handleCreateEditCategory() {
    if (!editForm) {
      return;
    }

    const category_name = editCategoryName.trim();
    if (!category_name) {
      Alert.alert("分类名称不能为空");
      return;
    }

    const category = await createCategory({ category_name, category_icon: "•" });
    setCategories((current) => [category, ...current]);
    setEditForm({ ...editForm, category_id: String(category.category_id) });
    setEditCategoryName("");
    setIsCreatingEditCategory(false);
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.iconButton}>
          <ChevronLeft size={20} color="#11181C" />
        </Pressable>
        <ThemedText type="title" style={styles.monthTitle}>
          {formatMonth(currentMonth)}
        </ThemedText>
        <Pressable onPress={() => shiftMonth(1)} style={styles.iconButton}>
          <ChevronRight size={20} color="#11181C" />
        </Pressable>
        <View style={styles.actionRow}>
          <Pressable style={styles.compactTextButton} onPress={() => router.push("/categories")}>
            <ThemedText style={styles.secondaryButtonText}>分类</ThemedText>
          </Pressable>
          <Pressable style={styles.iconPrimaryButton} onPress={() => router.push("/upload")}>
            <Upload size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.summaryRow}
        onPress={() =>
          router.push({
            pathname: "/monthly-category-stats",
            params: {
              year: String(currentMonth.getFullYear()),
              month: String(currentMonth.getMonth() + 1),
            },
          })
        }>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryLabel}>支出</ThemedText>
          <ThemedText style={styles.summaryValue}>¥{monthSummary.expense.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryLabel}>收入</ThemedText>
          <ThemedText style={styles.summaryValue}>¥{monthSummary.income.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryLabel}>结余</ThemedText>
          <ThemedText style={styles.summaryValue}>¥{monthSummary.balance.toFixed(2)}</ThemedText>
        </View>
      </Pressable>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.filterButton, filter === item.key ? styles.activeFilterButton : undefined]}>
            <ThemedText
              style={[styles.filterText, filter === item.key ? styles.activeFilterText : undefined]}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {groupedTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">暂无记录</ThemedText>
            <ThemedText style={styles.mutedText}>上传支付记录截图并确认后，交易会进入这里。</ThemedText>
          </View>
        ) : (
          groupedTransactions.map(([day, dayTransactions]) => (
            <View key={day} style={styles.dayGroup}>
              <ThemedText style={styles.dayTitle}>{day}</ThemedText>
              {dayTransactions.map((transaction) => {
                const category =
                  transaction.category_id === null
                    ? null
                    : categoryById.get(transaction.category_id);

                return (
                  <Pressable
                    key={transaction.transaction_id}
                    onPress={() => openEditModal(transaction)}
                    style={styles.transactionRow}>
                    <View style={styles.transactionMain}>
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {transaction.description || "未命名记录"}
                      </ThemedText>
                      <ThemedText style={styles.transactionMetaText}>
                        {formatTime(transaction.occurred_at)} ·{" "}
                        <ThemedText style={styles.transactionCategoryText}>
                          {category ? category.category_name : "未分类"}
                        </ThemedText>
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={[
                        styles.amountText,
                        transaction.transaction_type === TransactionType.Income
                          ? styles.incomeText
                          : styles.expenseText,
                      ]}>
                      {formatMoney(transaction.amount, transaction.transaction_type)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!editingTransaction}
        animationType="fade"
        transparent
        onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior="position"
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
            style={styles.modalKeyboardAvoider}
            contentContainerStyle={styles.modalKeyboardContent}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle">编辑记录</ThemedText>
                <Pressable onPress={closeEditModal}>
                  <ThemedText style={styles.linkText}>关闭</ThemedText>
                </Pressable>
              </View>

              {editForm ? (
                <View style={styles.form}>
                  <TextInput
                    value={editForm.description}
                    onChangeText={(description) => setEditForm({ ...editForm, description })}
                    placeholder="描述"
                    style={styles.input}
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      value={editForm.amount}
                      onChangeText={(amount) => setEditForm({ ...editForm, amount })}
                      keyboardType="decimal-pad"
                      placeholder="金额"
                      style={[styles.input, styles.amountInput]}
                    />
                    <TextInput
                      value={editForm.occurred_at}
                      onChangeText={(occurred_at) => setEditForm({ ...editForm, occurred_at })}
                      placeholder="2026-05-04 12:30"
                      style={[styles.input, styles.dateInput]}
                    />
                  </View>
                  <View style={styles.segmentRow}>
                    <Pressable
                      onPress={() =>
                        setEditForm({ ...editForm, transaction_type: String(TransactionType.Expense) })
                      }
                      style={[
                        styles.segmentButton,
                        editForm.transaction_type === String(TransactionType.Expense)
                          ? styles.activeSegment
                          : undefined,
                      ]}>
                      <ThemedText>支出</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setEditForm({ ...editForm, transaction_type: String(TransactionType.Income) })
                      }
                      style={[
                        styles.segmentButton,
                        editForm.transaction_type === String(TransactionType.Income)
                          ? styles.activeSegment
                          : undefined,
                      ]}>
                      <ThemedText>收入</ThemedText>
                    </Pressable>
                  </View>
                  {isCreatingEditCategory ? (
                    <View style={styles.categoryCreateInlineRow}>
                      <TextInput
                        value={editCategoryName}
                        onChangeText={setEditCategoryName}
                        placeholder="新分类"
                        style={[styles.input, styles.categoryCreateInput]}
                        returnKeyType="done"
                        onSubmitEditing={handleCreateEditCategory}
                      />
                      <Pressable
                        style={[styles.primaryButton, styles.categoryCreateButton]}
                        onPress={handleCreateEditCategory}>
                        <ThemedText style={styles.primaryButtonText}>新增</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.dangerButton, styles.categoryCreateButton]}
                        onPress={() => {
                          setEditCategoryName("");
                          setIsCreatingEditCategory(false);
                        }}>
                        <ThemedText style={styles.dangerButtonText}>取消</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <View
                      style={styles.categoryPickerRow}
                      onLayout={(event) => setCategoryPickerWidth(event.nativeEvent.layout.width)}>
                      <Pressable
                        onPress={() => setEditForm({ ...editForm, category_id: "" })}
                        style={[
                          styles.categoryChip,
                          categoryChipWidth ? { width: categoryChipWidth } : styles.categoryChipFallback,
                          editForm.category_id === "" ? styles.activeCategoryChip : undefined,
                        ]}>
                        <ThemedText style={styles.categoryChipText} numberOfLines={1}>未分类</ThemedText>
                      </Pressable>
                      {categories.map((category) => (
                        <Pressable
                          key={category.category_id}
                          onPress={() =>
                            setEditForm({
                              ...editForm,
                              category_id: String(category.category_id),
                            })
                          }
                          style={[
                            styles.categoryChip,
                            categoryChipWidth ? { width: categoryChipWidth } : styles.categoryChipFallback,
                            editForm.category_id === String(category.category_id)
                              ? styles.activeCategoryChip
                              : undefined,
                          ]}>
                          <ThemedText style={styles.categoryChipText} numberOfLines={1}>
                            {category.category_name}
                          </ThemedText>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => setIsCreatingEditCategory(true)}
                        style={[
                          styles.categoryChip,
                          categoryChipWidth ? { width: categoryChipWidth } : styles.categoryChipFallback,
                        ]}>
                        <ThemedText style={styles.categoryChipText} numberOfLines={1}>+ 分类</ThemedText>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.modalActionRow}>
                    <Pressable
                      style={[styles.primaryButton, styles.modalActionButton]}
                      onPress={handleSaveTransaction}>
                      <ThemedText style={styles.primaryButtonText}>保存</ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.dangerButton, styles.modalActionButton]}
                      onPress={handleDeleteTransaction}>
                      <ThemedText style={styles.dangerButtonText}>删除</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 38,
    backgroundColor: "#F7F8FA",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  monthTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 24,
  },
  iconButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  iconButtonText: {
    fontSize: 24,
    lineHeight: 28,
  },
  actionRow: {
    flexDirection: "row",
    gap: 6,
  },
  iconPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  compactTextButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  summaryRow: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    color: "#687076",
    fontSize: 11,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 8,
  },
  filterButton: {
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeFilterButton: {
    backgroundColor: "#11181C",
    borderColor: "#11181C",
  },
  filterText: {
    fontSize: 12,
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  listContent: {
    gap: 9,
    paddingBottom: 32,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  mutedText: {
    color: "#687076",
    fontSize: 12,
  },
  dayGroup: {
    gap: 6,
  },
  dayTitle: {
    color: "#687076",
    fontSize: 14,
    fontWeight: "700",
  },
  transactionRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  transactionMain: {
    flex: 1,
    gap: 0,
  },
  amountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  transactionMetaText: {
    color: "#687076",
    fontSize: 10,
  },
  transactionCategoryText: {
    color: "#0A7EA4",
    fontSize: 10,
    fontWeight: "700",
  },
  expenseText: {
    color: "#A6423A",
  },
  incomeText: {
    color: "#1F7A45",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 28, 0.28)",
    flex: 1,
    justifyContent: "center",
    padding: 12,
  },
  modalKeyboardAvoider: {
    width: "100%",
  },
  modalKeyboardContent: {
    width: "100%",
  },
  modalPanel: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 420,
    padding: 12,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  linkText: {
    color: "#0A7EA4",
    fontWeight: "700",
  },
  form: {
    gap: 6,
  },
  input: {
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#11181C",
    fontSize: 14,
    height: 34,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  inputRow: {
    flexDirection: "row",
    gap: 6,
  },
  amountInput: {
    flex: 0.36,
  },
  dateInput: {
    flex: 0.64,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
  },
  segmentButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 32,
    justifyContent: "center",
  },
  activeSegment: {
    backgroundColor: "#EEF6F9",
    borderColor: "#0A7EA4",
  },
  categoryPickerRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryCreateInlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    height: 34,
  },
  categoryCreateInput: {
    flex: 1,
  },
  categoryCreateButton: {
    height: 34,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  categoryChip: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  categoryChipFallback: {
    width: "31%",
  },
  categoryChipText: {
    fontSize: 13,
  },
  activeCategoryChip: {
    backgroundColor: "#EEF6F9",
    borderColor: "#0A7EA4",
  },
  dangerButton: {
    alignItems: "center",
    borderColor: "#D85C52",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    height: 34,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  modalActionButton: {
    flex: 1,
    height: 34,
    minHeight: 34,
  },
  dangerButtonText: {
    color: "#A6423A",
    fontWeight: "700",
  },
});
