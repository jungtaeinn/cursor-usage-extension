export type OptionsTabKey = "overview" | "team" | "settings";

export interface TabTransitionResult {
  nextTab: OptionsTabKey;
  shouldRefetch: boolean;
}

export function transitionTab(nextTab: OptionsTabKey): TabTransitionResult {
  return {
    nextTab,
    shouldRefetch: false
  };
}
