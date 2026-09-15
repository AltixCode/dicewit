import { fireEvent } from "@testing-library/react-native";
import React from "react";

import Home from "../index";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { FREE_PRESETS, useDiceStore } from "@/store/useDiceStore";
import { usePremiumStore } from "@/store/usePremiumStore";

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  useDiceStore.setState({ presets: [], history: [], diceColor: "default" });
});

// No `jest.restoreAllMocks()` here. It restores every spy in the process, not
// only this file's — including ones the renderer itself relies on — and the
// next test's tree then renders and is immediately torn down, which surfaces as
// "unable to find an element" on a screen that plainly renders it in isolation.
// `jest.clearAllMocks()` in beforeEach resets call counts, and each test that
// needs a spy installs its own.

describe("the roller", () => {
  it("renders its title and routes to the scorecard", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("rollerTitle"))).toBeTruthy();
    await fireEvent.press(getByText(t("scorecardTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/scorecard");
  });

  it("starts with an empty log and says so", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("emptyHistory"))).toBeTruthy();
  });

  it("rolls a valid notation and shows the total", async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t("notationLabel")), "2d6");
    await fireEvent.press(getByText(t("rollCta")));

    const total = useDiceStore.getState().history[0]!.total;
    expect(useDiceStore.getState().history).toHaveLength(1);
    expect(getByText(t("rollTotal", { total: String(total) }))).toBeTruthy();
  });

  it("explains notation it cannot read instead of rolling something else", async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t("notationLabel")), "rubbish");
    await fireEvent.press(getByText(t("rollCta")));

    expect(getByText(t("invalidNotation"))).toBeTruthy();
    expect(useDiceStore.getState().history).toHaveLength(0);
  });

  it("saves a preset and offers it back as a roll", async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t("notationLabel")), "4d8");
    await fireEvent.changeText(
      getByLabelText(t("presetNameLabel")),
      "Sneak attack",
    );
    await fireEvent.press(getByText(t("savePresetCta")));

    expect(useDiceStore.getState().presets[0]!.label).toBe("Sneak attack");
    expect(
      getByLabelText(t("usePreset", { name: "Sneak attack" })),
    ).toBeTruthy();
  });

  it("sends a free user at the preset cap to the paywall rather than failing quietly", async () => {
    // The alert is what the user sees; the store refusing is what makes it true.
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    useDiceStore.setState({
      presets: Array.from({ length: FREE_PRESETS }, (_, i) => ({
        id: `p${i}`,
        label: `P${i}`,
        notation: "1d6",
      })),
    });

    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t("notationLabel")), "1d6");
    await fireEvent.press(getByText(t("savePresetCta")));

    expect(alert).toHaveBeenCalled();
    expect(alert.mock.calls[0]![0]).toBe(t("presetLimitTitle"));
    expect(useDiceStore.getState().presets).toHaveLength(FREE_PRESETS);
  });

  it("shows the remaining preset allowance to a free user only", async () => {
    const free = await renderWithProviders(<Home />);
    expect(free.getByText(`0 / ${FREE_PRESETS}`)).toBeTruthy();

    usePremiumStore.setState({ isPremium: true });
    const paid = await renderWithProviders(<Home />);
    expect(paid.queryByText(`0 / ${FREE_PRESETS}`)).toBeNull();
  });
});
