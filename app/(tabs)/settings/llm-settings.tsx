import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { getConfigValue, setConfig } from "@/service";

const CONFIG_KEYS = {
  BASE_URL: "llm_base_url",
  API_KEY: "llm_api_key",
  MODEL: "llm_model",
} as const;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

export default function LlmSettingsScreen() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [storedBaseUrl, storedApiKey, storedModel] = await Promise.all([
        getConfigValue(CONFIG_KEYS.BASE_URL),
        getConfigValue(CONFIG_KEYS.API_KEY),
        getConfigValue(CONFIG_KEYS.MODEL),
      ]);
      setBaseUrl(storedBaseUrl || DEFAULT_BASE_URL);
      setApiKey(storedApiKey || "");
      setModel(storedModel || DEFAULT_MODEL);
    } catch (error) {
      console.error(error);
      Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取 LLM 配置");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [loadConfig]),
  );

  async function handleSave() {
    const nextBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    const nextApiKey = apiKey.trim();
    const nextModel = model.trim();

    if (!nextBaseUrl || !nextApiKey || !nextModel) {
      Alert.alert("配置不完整", "Base URL、API Key 和模型都需要填写");
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        setConfig(CONFIG_KEYS.BASE_URL, nextBaseUrl),
        setConfig(CONFIG_KEYS.API_KEY, nextApiKey),
        setConfig(CONFIG_KEYS.MODEL, nextModel),
      ]);
      setBaseUrl(nextBaseUrl);
      setApiKey(nextApiKey);
      setModel(nextModel);
      Alert.alert("已保存", "LLM 配置已更新");
    } catch (error) {
      console.error(error);
      Alert.alert("保存失败", error instanceof Error ? error.message : "无法保存 LLM 配置");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#11181C" />
        </Pressable>
        <View>
          <ThemedText type="title" style={styles.title}>
            LLM 配置
          </ThemedText>
          <ThemedText style={styles.subtitle}>用于把 OCR 文本整理为交易记录</ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#0A7EA4" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              平台
            </ThemedText>

            <ThemedText style={styles.label}>Base URL</ThemedText>
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder={DEFAULT_BASE_URL}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <ThemedText style={styles.label}>API Key</ThemedText>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              模型
            </ThemedText>

            <ThemedText style={styles.label}>Model</ThemedText>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder={DEFAULT_MODEL}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Pressable
            disabled={saving}
            style={[styles.primaryButton, saving ? styles.disabledButton : undefined]}
            onPress={handleSave}>
            <ThemedText style={styles.primaryButtonText}>{saving ? "保存中" : "保存配置"}</ThemedText>
          </Pressable>
        </ScrollView>
      )}
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
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  subtitle: {
    color: "#687076",
    fontSize: 13,
    marginTop: 3,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    gap: 12,
    padding: 12,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  label: {
    color: "#687076",
    fontSize: 13,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#11181C",
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.55,
  },
});
