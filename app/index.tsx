import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Die } from "@/components/Die";
import { Button, Screen, Text } from "@/components/ui";
import { t } from "@/i18n";
import { type RollResult } from "@/logic/notation";
import { FREE_PRESETS, useDiceStore } from "@/store/useDiceStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

/** Touch targets never go below this, whatever the type scale does. */
const MIN_TOUCH_TARGET = 44;

/**
 * The roller: type a notation, roll it, keep the ones worth keeping.
 *
 * The result is shown as dice rather than only a number, because the number alone is what a
 * calculator gives you — the reason to use a dice app at a table is seeing what each die did.
 */
export default function Roller() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const [notation, setNotation] = useState("");
  const [presetName, setPresetName] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [last, setLast] = useState<RollResult | null>(null);

  const isPremium = usePremiumStore((s) => s.isPremium);
  const presets = useDiceStore((s) => s.presets);
  const history = useDiceStore((s) => s.history);
  const rollNotation = useDiceStore((s) => s.rollNotation);
  const savePreset = useDiceStore((s) => s.savePreset);
  const removePreset = useDiceStore((s) => s.removePreset);
  const clearHistory = useDiceStore((s) => s.clearHistory);
  const exportHistory = useDiceStore((s) => s.exportHistory);

  const doRoll = useCallback(
    (text: string) => {
      const result = rollNotation(text, Math.random, isPremium);
      if (!result) {
        setInvalid(true);
        setLast(null);
        return;
      }
      setInvalid(false);
      setLast(result);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [rollNotation, isPremium],
  );

  const offerUpgrade = useCallback(() => {
    Alert.alert(t("presetLimitTitle"), t("presetLimitBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("removeAdsCta"), onPress: () => router.push("/paywall") },
    ]);
  }, [router]);

  const doSavePreset = useCallback(() => {
    const outcome = savePreset(presetName, notation, isPremium);
    if (outcome === "invalid") {
      setInvalid(true);
      return;
    }
    if (outcome === "limit-reached") {
      offerUpgrade();
      return;
    }
    setInvalid(false);
    setPresetName("");
  }, [savePreset, presetName, notation, isPremium, offerUpgrade]);

  const doExport = useCallback(() => {
    const text = exportHistory();
    if (!text) return;
    void Clipboard.setStringAsync(text);
    Alert.alert(t("exported"));
  }, [exportHistory]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* topInset, because this route sets headerShown:false -- with no
          navigation header above it, nothing else pays the notch, and the
          title renders underneath the status bar. */}
      <Screen scroll topInset>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("rollerTitle")}</Text>
          </View>
          <Button
            label={t("scorecardTitle")}
            variant="secondary"
            onPress={() => router.push("/scorecard")}
          />
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.lg }]}>
          <TextInput
            value={notation}
            onChangeText={(v) => {
              setNotation(v);
              setInvalid(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("notationHint")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("notationLabel")}
            onSubmitEditing={() => doRoll(notation)}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              color: colors.text,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          />
          <Button label={t("rollCta")} onPress={() => doRoll(notation)} />
        </View>

        {invalid ? (
          <Text
            variant="caption"
            tone="danger"
            style={{ marginTop: spacing.xs }}
          >
            {t("invalidNotation")}
          </Text>
        ) : null}

        {last ? (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.base,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={[styles.chips, { gap: spacing.sm }]}>
              {last.dice.map((face, i) => (
                <Die key={`${i}-${face}`} value={face} size={44} />
              ))}
            </View>
            <Text variant="numeric" style={{ marginTop: spacing.md }}>
              {t("rollTotal", { total: String(last.total) })}
            </Text>
          </View>
        ) : null}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.xl }}>
          {t("presetsTitle").toUpperCase()}
        </Text>
        <View
          style={[styles.chips, { gap: spacing.sm, marginTop: spacing.sm }]}
        >
          {presets.map((preset) => (
            <View key={preset.id} style={[styles.row, { gap: spacing.xs }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("usePreset", { name: preset.label })}
                onPress={() => doRoll(preset.notation)}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  justifyContent: "center",
                  paddingHorizontal: spacing.base,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Text variant="caption">{preset.label}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("deletePreset", { name: preset.label })}
                onPress={() => removePreset(preset.id)}
                hitSlop={8}
                style={{
                  minWidth: MIN_TOUCH_TARGET,
                  minHeight: MIN_TOUCH_TARGET,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="caption" tone="muted">
                  ✕
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}>
          <TextInput
            value={presetName}
            onChangeText={setPresetName}
            placeholder={t("presetNameLabel")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("presetNameLabel")}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              color: colors.text,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          />
          <Button
            label={t("savePresetCta")}
            variant="secondary"
            onPress={doSavePreset}
          />
        </View>
        {!isPremium ? (
          <Text variant="micro" tone="faint" style={{ marginTop: spacing.xs }}>
            {`${presets.length} / ${FREE_PRESETS}`}
          </Text>
        ) : null}

        <View style={[styles.titleRow, { marginTop: spacing.xl }]}>
          <View style={{ flex: 1 }}>
            <Text variant="micro" tone="faint">
              {t("historyTitle").toUpperCase()}
            </Text>
          </View>
          {history.length ? (
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Button
                label={t("exportCta")}
                variant="ghost"
                onPress={doExport}
              />
              <Button
                label={t("clearHistoryCta")}
                variant="ghost"
                onPress={clearHistory}
              />
            </View>
          ) : null}
        </View>

        {history.length === 0 ? (
          <Text
            variant="caption"
            tone="muted"
            style={{ marginTop: spacing.sm }}
          >
            {t("emptyHistory")}
          </Text>
        ) : (
          history.map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.titleRow,
                {
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {`${entry.notation}  [${entry.dice.join(", ")}]`}
              </Text>
              <Text variant="bodyStrong">{String(entry.total)}</Text>
            </View>
          ))
        )}
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
});
