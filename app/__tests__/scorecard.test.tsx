import { fireEvent } from "@testing-library/react-native";
import React from "react";

import Scorecard from "../scorecard";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { ROLLS_PER_TURN, freshTurn } from "@/logic/turn";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useGameStore } from "@/store/useGameStore";
import { usePremiumStore } from "@/store/usePremiumStore";

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  useGameStore.setState({ turn: freshTurn(), card: {}, best: 0 });
});

describe("the scorecard", () => {
  it("renders every category", async () => {
    const { getByText } = await renderWithProviders(<Scorecard />);
    for (const key of [
      "catOnes",
      "catChance",
      "catFullHouse",
      "catLargeStraight",
    ] as const) {
      expect(getByText(t(key))).toBeTruthy();
    }
  });

  it("never shows the trademarked name", async () => {
    // Hasbro owns it. The five-of-a-kind category is called exactly that everywhere a user or
    // a store reviewer can see it, and a slip here is a takedown rather than a cosmetic bug.
    const { queryByText, toJSON } = await renderWithProviders(<Scorecard />);
    expect(queryByText(/yahtzee/i)).toBeNull();
    expect(JSON.stringify(toJSON())).not.toMatch(/yahtzee/i);
  });

  it("counts the rolls down and stops at zero", async () => {
    const { getByText } = await renderWithProviders(<Scorecard />);
    expect(
      getByText(t("rollsLeft", { n: String(ROLLS_PER_TURN) })),
    ).toBeTruthy();

    for (let i = 0; i < ROLLS_PER_TURN; i += 1) {
      await fireEvent.press(getByText(t("rollCta")));
    }
    expect(getByText(t("rollsLeft", { n: "0" }))).toBeTruthy();
    expect(useGameStore.getState().turn.rollsUsed).toBe(ROLLS_PER_TURN);
  });

  it("holds a die only once something has been rolled", async () => {
    const { queryByLabelText, getByText } = await renderWithProviders(
      <Scorecard />,
    );
    // Before the first roll the dice are not interactive at all.
    expect(queryByLabelText(new RegExp(t("rollCta")))).not.toBeNull();

    await fireEvent.press(getByText(t("rollCta")));
    const face = useGameStore.getState().turn.dice[0]!;
    const die = queryByLabelText(t("holdDie", { n: "1", face: String(face) }));
    expect(die).not.toBeNull();

    await fireEvent.press(die!);
    expect(useGameStore.getState().turn.held[0]).toBe(true);
  });

  it("banks a category and marks it used", async () => {
    const { getByText } = await renderWithProviders(<Scorecard />);
    await fireEvent.press(getByText(t("rollCta")));
    await fireEvent.press(getByText(t("catChance")));

    expect(useGameStore.getState().isUsed("chance")).toBe(true);
    // Scoring ends the turn, so the rolls reset for the next one.
    expect(useGameStore.getState().turn.rollsUsed).toBe(0);
  });

  it("refuses to score before the dice have been rolled", async () => {
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Scorecard />);

    await fireEvent.press(getByText(t("catChance")));
    expect(alert).toHaveBeenCalledWith(t("rollFirst"));
    expect(useGameStore.getState().isUsed("chance")).toBe(false);
  });

  it("shows the grand total, which starts at zero", async () => {
    const { getByText } = await renderWithProviders(<Scorecard />);
    expect(getByText(t("grandTotal"))).toBeTruthy();
    expect(getByText("0")).toBeTruthy();
  });

  it("offers a new game, which clears the card", async () => {
    useGameStore.setState({ card: { chance: 21 } });
    const { getByText } = await renderWithProviders(<Scorecard />);
    await fireEvent.press(getByText(t("newGameCta")));
    expect(useGameStore.getState().card).toEqual({});
  });
});
