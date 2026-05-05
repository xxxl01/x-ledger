import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import type { Category, Transaction } from "@/db/schema";
import { getAllCategories, getTransactionsByMonth, TransactionType } from "@/service";
import { useFocusEffect } from "@react-navigation/native";

type CategoryStat = {
  key: string;
  name: string;
  amount: number;
  percent: number;
};

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

function getMonthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function buildCategoryStats(
  transactions: Transaction[],
  categories: Category[],
  transactionType: number,
): CategoryStat[] {
  const categoryById = new Map(categories.map((category) => [category.category_id, category]));
  const amounts = new Map<string, { name: string; amount: number }>();

  for (const transaction of transactions) {
    if (transaction.transaction_type !== transactionType) {
      continue;
    }

    const key = transaction.category_id === null ? "uncategorized" : String(transaction.category_id);
    const category =
      transaction.category_id === null ? null : categoryById.get(transaction.category_id);
    const current = amounts.get(key) ?? {
      name: category?.category_name ?? "未分类",
      amount: 0,
    };
    current.amount += Number(transaction.amount);
    amounts.set(key, current);
  }

  const rows = Array.from(amounts.entries())
    .map(([key, value]) => ({ key, ...value }))
    .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, item) => sum + item.amount, 0);

  return rows.map((item) => ({
    ...item,
    percent: total > 0 ? item.amount / total : 0,
  }));
}

export default function MonthlyCategoryStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadData = useCallback(async () => {
    const [nextTransactions, nextCategories] = await Promise.all([
      getTransactionsByMonth(year, month),
      getAllCategories(),
    ]);
    setTransactions(nextTransactions);
    setCategories(nextCategories);
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch((error) => {
        console.error(error);
        Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取分类统计");
      });
    }, [loadData]),
  );

  const expenseStats = useMemo(
    () => buildCategoryStats(transactions, categories, TransactionType.Expense),
    [categories, transactions],
  );
  const incomeStats = useMemo(
    () => buildCategoryStats(transactions, categories, TransactionType.Income),
    [categories, transactions],
  );
  const expenseTotal = expenseStats.reduce((sum, item) => sum + item.amount, 0);
  const incomeTotal = incomeStats.reduce((sum, item) => sum + item.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#11181C" />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText type="title" style={styles.title}>
            分类统计
          </ThemedText>
          <ThemedText style={styles.subtitle}>{getMonthLabel(year, month)}</ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsPanel}>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <ThemedText style={styles.totalLabel}>支出</ThemedText>
              <ThemedText style={styles.totalValue}>{formatMoney(expenseTotal)}</ThemedText>
            </View>
            <View style={styles.totalItem}>
              <ThemedText style={styles.totalLabel}>收入</ThemedText>
              <ThemedText style={styles.totalValue}>{formatMoney(incomeTotal)}</ThemedText>
            </View>
          </View>

          <StatsSection title="支出分类" rows={expenseStats} barColor="#A6423A" />
          <View style={styles.divider} />
          <StatsSection title="收入分类" rows={incomeStats} barColor="#1F7A45" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatsSection({
  title,
  rows,
  barColor,
}: {
  title: string;
  rows: CategoryStat[];
  barColor: string;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {rows.length === 0 ? (
        <ThemedText style={styles.mutedText}>本月暂无数据。</ThemedText>
      ) : (
        rows.map((row) => (
          <View key={row.key} style={styles.statRow}>
            <View style={styles.statHeader}>
              <ThemedText type="defaultSemiBold" style={styles.statName}>
                {row.name}
              </ThemedText>
              <ThemedText style={styles.percentText}>{(row.percent * 100).toFixed(1)}%</ThemedText>
              <ThemedText style={styles.statAmount}>{formatMoney(row.amount)}</ThemedText>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: barColor,
                    width: `${Math.max(row.percent * 100, 2)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 18,
    paddingTop: 12,
  },
  backButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    color: "#687076",
    fontSize: 14,
  },
  content: {
    paddingBottom: 32,
  },
  statsPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  totalRow: {
    flexDirection: "row",
  },
  totalItem: {
    flex: 1,
    gap: 2,
  },
  totalLabel: {
    color: "#687076",
    fontSize: 13,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  section: {
    gap: 7,
  },
  sectionTitle: {
    color: "#11181C",
    fontSize: 15,
    fontWeight: "800",
  },
  divider: {
    backgroundColor: "#EEF0F2",
    height: 1,
  },
  statRow: {
    gap: 5,
  },
  statHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statName: {
    flex: 1,
    fontSize: 14,
  },
  statAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  barTrack: {
    backgroundColor: "#EEF0F2",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  barFill: {
    borderRadius: 999,
    height: "100%",
  },
  percentText: {
    color: "#687076",
    fontSize: 12,
  },
  mutedText: {
    color: "#687076",
    fontSize: 14,
  },
});
