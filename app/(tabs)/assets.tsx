import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import type { Asset } from "@/db/schema";
import { createAsset, getAllAssets, updateAsset } from "@/service";

type AssetDraft = {
  account_name: string;
  amount: string;
};

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

function getAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default function AssetsScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [drafts, setDrafts] = useState<Record<number, AssetDraft>>({});
  const [newAccountName, setNewAccountName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);

  const loadAssets = useCallback(async () => {
    const nextAssets = await getAllAssets();
    setAssets(nextAssets);
    setDrafts(
      Object.fromEntries(
        nextAssets.map((asset) => [
          asset.asset_id,
          {
            account_name: asset.account_name,
            amount: String(asset.amount),
          },
        ]),
      ),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAssets().catch((error) => {
        console.error(error);
        Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取资产");
      });
    }, [loadAssets]),
  );

  const totalAssets = useMemo(() => {
    return assets.reduce((sum, asset) => sum + getAmount(String(asset.amount)), 0);
  }, [assets]);

  async function handleCreateAsset() {
    const account_name = newAccountName.trim();
    const amount = Math.abs(Number(newAmount || "0"));

    if (!account_name) {
      Alert.alert("账户名称不能为空");
      return;
    }

    if (!Number.isFinite(amount)) {
      Alert.alert("金额无效", "请输入有效金额");
      return;
    }

    await createAsset({ account_name, amount: amount.toFixed(2) });
    setNewAccountName("");
    setNewAmount("");
    setIsAddingAsset(false);
    await loadAssets();
  }

  async function handleSaveAsset(asset_id: number) {
    const draft = drafts[asset_id];
    if (!draft) {
      return;
    }

    const account_name = draft.account_name.trim();
    const amount = Number(draft.amount);

    if (!account_name) {
      Alert.alert("账户名称不能为空");
      return;
    }

    if (!Number.isFinite(amount)) {
      Alert.alert("金额无效", "请输入有效金额");
      return;
    }

    await updateAsset(asset_id, {
      account_name,
      amount: amount.toFixed(2),
    });
    setEditingAssetId(null);
    await loadAssets();
  }

  function updateDraft(asset_id: number, patch: Partial<AssetDraft>) {
    setDrafts((current) => ({
      ...current,
      [asset_id]: {
        ...current[asset_id],
        ...patch,
      },
    }));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoider}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            资产
          </ThemedText>
        </View>

        <View style={styles.totalPanel}>
          <ThemedText style={styles.totalLabel}>总资产</ThemedText>
          <ThemedText style={styles.totalValue}>{formatMoney(totalAssets)}</ThemedText>
        </View>

        <View style={styles.assetPanel}>
          {isAddingAsset ? (
            <View style={styles.createRow}>
              <TextInput
                value={newAccountName}
                onChangeText={setNewAccountName}
                placeholder="账户"
                style={[styles.input, styles.nameInput]}
              />
              <TextInput
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="decimal-pad"
                placeholder="金额"
                style={[styles.input, styles.amountInput]}
              />
              <Pressable style={styles.primaryButton} onPress={handleCreateAsset}>
                <ThemedText style={styles.primaryButtonText}>保存</ThemedText>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setNewAccountName("");
                  setNewAmount("");
                  setIsAddingAsset(false);
                }}>
                <ThemedText style={styles.secondaryButtonText}>取消</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addAssetButton} onPress={() => setIsAddingAsset(true)}>
              <ThemedText style={styles.addAssetText}>+ 新增账户</ThemedText>
            </Pressable>
          )}

          <ScrollView contentContainerStyle={styles.listContent}>
            {assets.map((asset) => {
              const draft = drafts[asset.asset_id] ?? {
                account_name: asset.account_name,
                amount: String(asset.amount),
              };

              return (
                <View key={asset.asset_id} style={styles.assetRow}>
                  {editingAssetId === asset.asset_id ? (
                    <>
                      <TextInput
                        value={draft.account_name}
                        onChangeText={(account_name) => updateDraft(asset.asset_id, { account_name })}
                        placeholder="账户"
                        style={[styles.input, styles.nameInput]}
                      />
                      <TextInput
                        value={draft.amount}
                        onChangeText={(amount) => updateDraft(asset.asset_id, { amount })}
                        keyboardType="decimal-pad"
                        placeholder="金额"
                        style={[styles.input, styles.amountInput]}
                      />
                      <Pressable
                        style={styles.primaryButton}
                        onPress={() => handleSaveAsset(asset.asset_id)}>
                        <ThemedText style={styles.primaryButtonText}>保存</ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.assetInfo}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                          {asset.account_name}
                        </ThemedText>
                        <ThemedText style={styles.assetAmount}>{formatMoney(getAmount(String(asset.amount)))}</ThemedText>
                      </View>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => setEditingAssetId(asset.asset_id)}>
                        <ThemedText style={styles.secondaryButtonText}>编辑</ThemedText>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}
            {assets.length === 0 ? <ThemedText style={styles.mutedText}>还没有资产账户。</ThemedText> : null}
          </ScrollView>
        </View>
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
    paddingBottom: 12,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
  },
  totalPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: {
    color: "#687076",
    fontSize: 13,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  assetPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  createRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingBottom: 10,
  },
  addAssetButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginBottom: 4,
  },
  addAssetText: {
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#11181C",
    fontSize: 14,
    height: 34,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  nameInput: {
    flex: 1,
  },
  amountInput: {
    flex: 0.72,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#11181C",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 8,
  },
  assetRow: {
    alignItems: "center",
    borderTopColor: "#EEF0F2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
  },
  assetInfo: {
    flex: 1,
    gap: 2,
  },
  assetAmount: {
    color: "#11181C",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D8DDE3",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  mutedText: {
    color: "#687076",
    fontSize: 14,
    paddingVertical: 8,
  },
});
