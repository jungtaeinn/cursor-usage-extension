import {
  DEFAULT_CONFIG,
  EMPTY_ALERT_STATE,
  EMPTY_SNAPSHOT,
  type AlertState,
  type AppConfig,
  type StorageAdapter,
  type SyncSnapshot
} from "@cursor-usage/core";

const STORAGE_KEYS = {
  config: "cue_config",
  snapshot: "cue_snapshot",
  alertState: "cue_alert_state"
} as const;

async function getFromStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

export class ChromeStorageAdapter implements StorageAdapter {
  async getConfig(): Promise<AppConfig> {
    return getFromStorage<AppConfig>(STORAGE_KEYS.config, DEFAULT_CONFIG);
  }

  async setConfig(config: AppConfig): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: config });
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    return getFromStorage<SyncSnapshot>(STORAGE_KEYS.snapshot, EMPTY_SNAPSHOT);
  }

  async setSnapshot(snapshot: SyncSnapshot): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.snapshot]: snapshot });
  }

  async getAlertState(): Promise<AlertState> {
    return getFromStorage<AlertState>(STORAGE_KEYS.alertState, EMPTY_ALERT_STATE);
  }

  async setAlertState(state: AlertState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.alertState]: state });
  }
}
