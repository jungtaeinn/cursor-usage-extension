import { DEFAULT_CONFIG, EMPTY_ALERT_STATE, EMPTY_SNAPSHOT } from "../constants";
import type { AlertState, AppConfig, StorageAdapter, SyncSnapshot } from "../types";

export class MemoryStorageAdapter implements StorageAdapter {
  private config: AppConfig = DEFAULT_CONFIG;
  private snapshot: SyncSnapshot = EMPTY_SNAPSHOT;
  private alertState: AlertState = EMPTY_ALERT_STATE;

  async getConfig(): Promise<AppConfig> {
    return structuredClone(this.config);
  }

  async setConfig(config: AppConfig): Promise<void> {
    this.config = structuredClone(config);
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    return structuredClone(this.snapshot);
  }

  async setSnapshot(snapshot: SyncSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }

  async getAlertState(): Promise<AlertState> {
    return structuredClone(this.alertState);
  }

  async setAlertState(state: AlertState): Promise<void> {
    this.alertState = structuredClone(state);
  }
}
