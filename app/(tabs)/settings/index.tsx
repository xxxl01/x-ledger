import { useRouter } from "expo-router";
import { Bot, ChevronRight, Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SettingsItem = {
  key: string;
  title: string;
  description: string;
  route: string;
};

const SETTINGS_ITEMS: SettingsItem[] = [
  {
    key: "llm-settings",
    title: "LLM 配置",
    description: "设置支付记录识别使用的 API 地址、Key 和模型",
    route: "/(tabs)/settings/llm-settings",
  },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Settings size={24} color="#11181C" />
        <Text style={styles.title}>
          设置
        </Text>
      </View>

      <View style={styles.list}>
        {SETTINGS_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            style={styles.card}
            onPress={() => router.push(item.route as never)}>
            <View style={styles.leadingIcon}>
              <Bot size={20} color="#0A7EA4" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </Pressable>
        ))}
      </View>
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    color: "#11181C",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 32,
  },
  list: {
    paddingHorizontal: 12,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E6EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    height: 64,
    marginVertical: 6,
    paddingHorizontal: 14,
  },
  leadingIcon: {
    alignItems: "center",
    backgroundColor: "#EAF7FB",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  textWrap: {
    flex: 1,
    gap: 1,
    justifyContent: "center",
  },
  itemTitle: {
    color: "#11181C",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
  },
  description: {
    color: "#687076",
    fontSize: 10,
    lineHeight: 17,
  },
});
