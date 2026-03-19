import type { AppConfig, SetUserSpendLimitRequest, SyncSnapshot } from "@cursor-usage/core";

export type BackgroundMessage =
  | { type: "get-state" }
  | { type: "save-config"; payload: AppConfig }
  | { type: "manual-sync" }
  | { type: "validate-api-key"; payload: { apiKey: string } }
  | { type: "set-user-spend-limit"; payload: SetUserSpendLimitRequest };

export interface StateMessagePayload {
  config: AppConfig;
  snapshot: SyncSnapshot;
}

export type RuntimePushMessage = {
  type: "state-updated";
  payload: StateMessagePayload;
};
