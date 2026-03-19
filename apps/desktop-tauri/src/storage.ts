import {
  DEFAULT_CONFIG,
  EMPTY_ALERT_STATE,
  EMPTY_SNAPSHOT,
  type AlertState,
  type AppConfig,
  type StorageAdapter,
  type SyncSnapshot
} from "@cursor-usage/core";

const KEYS = {
  config: "cue_desktop_config",
  snapshot: "cue_desktop_snapshot",
  alertState: "cue_desktop_alert_state"
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export class DesktopStorageAdapter implements StorageAdapter {
  async getConfig(): Promise<AppConfig> {
    return readJson<AppConfig>(KEYS.config, DEFAULT_CONFIG);
  }

  async setConfig(config: AppConfig): Promise<void> {
    writeJson(KEYS.config, config);
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    return readJson<SyncSnapshot>(KEYS.snapshot, EMPTY_SNAPSHOT);
  }

  async setSnapshot(snapshot: SyncSnapshot): Promise<void> {
    writeJson(KEYS.snapshot, snapshot);
  }

  async getAlertState(): Promise<AlertState> {
    return readJson<AlertState>(KEYS.alertState, EMPTY_ALERT_STATE);
  }

  async setAlertState(state: AlertState): Promise<void> {
    writeJson(KEYS.alertState, state);
  }
}
