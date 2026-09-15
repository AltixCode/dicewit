import React from "react";
import { Pressable, View } from "react-native";

import { t } from "@/i18n";
import { useDiceStore } from "@/store/useDiceStore";
import { dicePalette } from "@/theme/dice";
import { useTheme } from "@/theme";

/**
 * One die.
 *
 * The pips are laid out from a fixed map rather than computed, because the arrangement of a
 * real die is not a formula: four is two columns, six is two columns of three, and five is
 * four corners plus a centre. Generating them from the number gets three and five wrong in a
 * way that looks almost right.
 */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

interface DieProps {
  /** 1–6. Zero means "not yet rolled" and renders as a blank face. */
  value: number;
  size?: number;
  held?: boolean;
  /** Omit to render a die that is not interactive — the roller's result, for instance. */
  onPress?: () => void;
  /** Position in the hand, 1-based, for the accessibility label. */
  index?: number;
}

export function Die({
  value,
  size = 56,
  held = false,
  onPress,
  index,
}: DieProps) {
  const { colors, radius, isDark } = useTheme();
  const diceColor = useDiceStore((s) => s.diceColor);
  const palette = dicePalette(diceColor, isDark ? 'dark' : 'light');
  const pips = PIPS[value] ?? [];
  const pip = Math.max(6, Math.round(size * 0.16));
  const gap = (size - pip * 3) / 4;

  const face = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: palette.face,
        borderWidth: held ? 3 : 1,
        borderColor: held ? palette.held : colors.border,
        padding: gap,
        justifyContent: "space-between",
      }}
    >
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={{ flexDirection: "row", justifyContent: "space-between" }}
        >
          {[0, 1, 2].map((col) => {
            const on = pips.some(([r, c]) => r === row && c === col);
            return (
              <View
                key={col}
                style={{
                  width: pip,
                  height: pip,
                  borderRadius: pip / 2,
                  backgroundColor: on ? palette.pip : "transparent",
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  if (!onPress) return face;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: held }}
      accessibilityLabel={t(held ? "heldDie" : "holdDie", {
        n: String(index ?? 1),
        face: String(value),
      })}
      onPress={onPress}
      // The die is 56pt; the hit area is padded out to the 44pt minimum in every direction so
      // a miss between two dice does not silently hold the wrong one.
      hitSlop={8}
    >
      {face}
    </Pressable>
  );
}

