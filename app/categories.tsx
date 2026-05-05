import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import type { Category } from "@/db/schema";
import {
  createCategory,
  deleteCategoryAndUnassignTransactions,
  getAllCategories,
} from "@/service";

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    const nextCategories = await getAllCategories();
    setCategories(nextCategories);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCategories().catch((error) => {
        console.error(error);
        Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取分类");
      });
    }, [loadCategories]),
  );

  async function handleCreateCategory() {
    const category_name = newCategoryName.trim();

    if (!category_name) {
      Alert.alert("分类名称不能为空");
      return;
    }

    setIsSaving(true);
    try {
      await createCategory({ category_name, category_icon: "•" });
      setNewCategoryName("");
      await loadCategories();
    } catch (error) {
      console.error(error);
      Alert.alert("新增失败", error instanceof Error ? error.message : "无法新增分类");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCategory(category_id: number) {
    await deleteCategoryAndUnassignTransactions(category_id);
    await loadCategories();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoider}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={22} color="#11181C" />
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText type="title" style={styles.title}>
              分类
            </ThemedText>
            <ThemedText style={styles.subtitle}>管理账本记录的分类名称</ThemedText>
          </View>
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="分类名称"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleCreateCategory}
          />
          <Pressable
            disabled={isSaving}
            style={[styles.primaryButton, isSaving ? styles.disabledButton : undefined]}
            onPress={handleCreateCategory}>
            <ThemedText style={styles.primaryButtonText}>新增</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
          {categories.map((category) => (
            <View key={category.category_id} style={styles.categoryRow}>
              <ThemedText type="defaultSemiBold">{category.category_name}</ThemedText>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteCategory(category.category_id)}>
                <ThemedText style={styles.deleteText}>删除</ThemedText>
              </Pressable>
            </View>
          ))}
          {categories.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle">还没有分类</ThemedText>
              <ThemedText style={styles.mutedText}>新增后可在编辑记录时选择。</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  keyboardAvoider: {
    flex: 1,
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
  createRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#11181C",
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.56,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    gap: 8,
    paddingBottom: 32,
    paddingTop: 14,
  },
  categoryRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  deleteText: {
    color: "#A6423A",
    fontWeight: "700",
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
    fontSize: 14,
  },
});
