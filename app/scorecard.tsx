import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Die } from "@/components/Die";
import { Button, Screen, Text } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n";
import { ROLLS_PER_TURN } from "@/logic/turn";
import {
  LOWER_CATEGORIES,
  UPPER_CATEGORIES,
  type Category,
  scoreFor,
  upperBonusGap,
} from "@/logic/yahtzee";
import { useGameStore } from "@/store/useGameStore";
import { useTheme } from "@/theme";

const MIN_TOUCH_TARGET = 44;

/**
 * The category names are deliberately generic. "Yahtzee" is a Hasbro trademark, so the
 * five-of-a-kind category is called exactly that everywhere a user or a store reviewer can
 * see it; only the internal key keeps the familiar spelling.
 */
const CATEGORY_KEY: Record<Category, TranslationKey> = {
  ones: "catOnes",
  twos: "catTwos",
  threes: "catThrees",
  fours: "catFours",
  fives: "catFives",
  sixes: "catSixes",
  threeOfAKind: "catThreeOfAKind",
  fourOfAKind: "catFourOfAKind",
  fullHouse: "catFullHouse",
  smallStraight: "catSmallStraight",
  largeStraight: "catLargeStraight",
  yahtzee: "catYahtzee",
  chance: "catChance",
};

export default function Scorecard() {
  const { colors, spacing, radius } = useTheme();

  const turn = useGameStore((s) => s.turn);
  const card = useGameStore((s) => s.card);
  const best = useGameStore((s) => s.best);
  const roll = useGameStore((s) => s.roll);
  const hold = useGameStore((s) => s.hold);
  const score = useGameStore((s) => s.score);
  const newGame = useGameStore((s) => s.newGame);

  // Derived from `card` on every render rather than stored: a total kept in state is a second
  // source of truth for something that is already a pure function of the card.
  const totals = useGameStore((s) => s.totals)();
  const gap = upperBonusGap(card);
  const rollsLeft = ROLLS_PER_TURN - turn.rollsUsed;
  const rolled = turn.rollsUsed > 0;

  const doRoll = useCallback(() => {
    if (roll() === "rolled")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [roll]);

  const doScore = useCallback(
    (category: Category) => {
      const outcome = score(category);
      if (outcome === "no-roll") {
        Alert.alert(t("rollFirst"));
        return;
      }
      if (outcome !== "scored") return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Read the card back through the store rather than the stale closure value.
      const state = useGameStore.getState();
      if (state.isComplete()) {
        Alert.alert(
          t("gameOverTitle"),
          t("gameOverBody", { score: String(state.totals().grand) }),
        );
      }
    },
    [score],
  );

  const rows = useMemo(
    () => [
      {
        title: t("upperSection"),
        categories: UPPER_CATEGORIES as readonly Category[],
      },
      {
        title: t("lowerSection"),
        categories: LOWER_CATEGORIES as readonly Category[],
      },
    ],
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("scorecardTitle")}</Text>
            {best > 0 ? (
              <Text variant="caption" tone="muted">
                {t("bestLabel", { score: String(best) })}
              </Text>
            ) : null}
          </View>
          <Button
            label={t("newGameCta")}
            variant="secondary"
            onPress={newGame}
          />
        </View>

        <View
          style={[styles.chips, { gap: spacing.sm, marginTop: spacing.lg }]}
        >
          {turn.dice.map((face, i) => (
            <Die
              key={i}
              value={face}
              index={i + 1}
              held={turn.held[i] ?? false}
              onPress={rolled ? () => hold(i) : undefined}
            />
          ))}
        </View>

        <View style={[styles.row, { gap: spacing.md, marginTop: spacing.md }]}>
          <Button
            label={t("rollCta")}
            onPress={doRoll}
            disabled={rollsLeft === 0}
            style={{ flex: 1 }}
          />
          <Text variant="caption" tone="muted">
            {t("rollsLeft", { n: String(rollsLeft) })}
          </Text>
        </View>

        {rows.map((section) => (
          <View key={section.title} style={{ marginTop: spacing.xl }}>
            <Text variant="micro" tone="faint">
              {section.title.toUpperCase()}
            </Text>
            {section.categories.map((category) => {
              const used = card[category] !== undefined;
              const banked = card[category];
              // The score this hand would bank, shown only while there is a hand to score.
              const preview =
                rolled && !used ? scoreFor(category, turn.dice) : null;
              const shown = used ? banked : preview;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  disabled={used}
                  accessibilityState={{ disabled: used }}
                  accessibilityLabel={
                    used
                      ? t("alreadyScored", {
                          category: t(CATEGORY_KEY[category]),
                          n: String(banked ?? 0),
                        })
                      : t("scoreInto", {
                          category: t(CATEGORY_KEY[category]),
                          n: String(preview ?? 0),
                        })
                  }
                  onPress={() => doScore(category)}
                  style={{
                    minHeight: MIN_TOUCH_TARGET,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: spacing.base,
                    marginTop: spacing.xs,
                    borderRadius: radius.md,
                    backgroundColor: used ? colors.surfaceAlt : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    variant="body"
                    tone={used ? "muted" : "default"}
                    style={{ flex: 1 }}
                  >
                    {t(CATEGORY_KEY[category])}
                  </Text>
                  <Text variant="bodyStrong" tone={used ? "muted" : "accent"}>
                    {shown === null ? "—" : String(shown)}
                  </Text>
                </Pressable>
              );
            })}
            {section.title === t("upperSection") && gap > 0 ? (
              <Text
                variant="micro"
                tone="faint"
                style={{ marginTop: spacing.xs }}
              >
                {t("bonusGap", { n: String(gap) })}
              </Text>
            ) : null}
            {section.title === t("upperSection") && totals.bonus > 0 ? (
              <View style={[styles.titleRow, { marginTop: spacing.xs }]}>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  {t("bonusLabel")}
                </Text>
                <Text variant="bodyStrong" tone="accent">
                  {String(totals.bonus)}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        <View
          style={[
            styles.titleRow,
            {
              marginTop: spacing.xl,
              paddingVertical: spacing.base,
              borderTopWidth: 1,
              borderTopColor: colors.borderStrong,
            },
          ]}
        >
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {t("grandTotal")}
          </Text>
          <Text variant="numeric">{String(totals.grand)}</Text>
        </View>
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
