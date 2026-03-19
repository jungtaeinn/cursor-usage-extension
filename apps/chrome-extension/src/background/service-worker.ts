import {
  CursorApiClient,
  CursorApiError,
  SyncService,
  type SyncSnapshot
} from "@cursor-usage/core";

import type { BackgroundMessage, RuntimePushMessage, StateMessagePayload } from "./messages";
import { ChromeStorageAdapter } from "./storage";

const ALARM_SPEND_5M = "cue_sync_spend_5m";
const ALARM_DAILY_1H = "cue_sync_daily_1h";

const storage = new ChromeStorageAdapter();
const syncService = new SyncService({ storage });

async function getStatePayload(): Promise<StateMessagePayload> {
  const [config, snapshot] = await Promise.all([storage.getConfig(), syncService.getSnapshot()]);
  return { config, snapshot };
}

function broadcastState(payload: StateMessagePayload): void {
  const message: RuntimePushMessage = {
    type: "state-updated",
    payload
  };
  chrome.runtime.sendMessage(message).catch(() => {
    // 수신중인 UI가 없을 때 발생하는 에러는 무시한다.
  });
}

async function syncAndBroadcast(
  syncTask: Promise<SyncSnapshot>,
  fallbackSource: "manual" | "background" | "startup"
): Promise<SyncSnapshot> {
  try {
    const snapshot = await syncTask;
    const payload = await getStatePayload();
    broadcastState(payload);
    return snapshot;
  } catch (error) {
    console.error("[Cursor Usage Extension] sync failed", fallbackSource, error);
    throw error;
  }
}

async function ensureAlarms(): Promise<void> {
  await chrome.alarms.create(ALARM_SPEND_5M, {
    delayInMinutes: 0.1,
    periodInMinutes: 5
  });
  await chrome.alarms.create(ALARM_DAILY_1H, {
    delayInMinutes: 1,
    periodInMinutes: 60
  });
}

function isStale(snapshot: SyncSnapshot): boolean {
  if (!snapshot.lastSyncAt) {
    return true;
  }
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - snapshot.lastSyncAt > fiveMinutes;
}

syncService.subscribe(async () => {
  const payload = await getStatePayload();
  broadcastState(payload);
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarms();
  void syncAndBroadcast(syncService.syncAll({ source: "startup" }), "startup");
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarms();
  void syncAndBroadcast(syncService.syncSpend("startup"), "startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_SPEND_5M) {
    void syncAndBroadcast(syncService.syncSpend("background"), "background");
    return;
  }
  if (alarm.name === ALARM_DAILY_1H) {
    void syncAndBroadcast(syncService.syncDailyUsage("background"), "background");
  }
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "get-state": {
        const payload = await getStatePayload();
        sendResponse(payload);
        if (isStale(payload.snapshot)) {
          void syncAndBroadcast(syncService.syncSpend("background"), "background");
        }
        return;
      }
      case "save-config": {
        await storage.setConfig(message.payload);
        void syncAndBroadcast(syncService.syncSpend("manual"), "manual");
        const payload = await getStatePayload();
        sendResponse(payload);
        return;
      }
      case "manual-sync": {
        const snapshot = await syncAndBroadcast(
          syncService.syncAll({ source: "manual", manual: true }),
          "manual"
        );
        sendResponse(snapshot);
        return;
      }
      case "validate-api-key": {
        const apiKey = message.payload.apiKey.trim();
        if (!apiKey) {
          sendResponse({
            ok: false,
            status: 400,
            message: "API key is required."
          });
          return;
        }

        try {
          await new CursorApiClient(apiKey).postSpend({ page: 1, pageSize: 1 });
          sendResponse({ ok: true });
        } catch (error) {
          if (error instanceof CursorApiError) {
            sendResponse({
              ok: false,
              status: error.status,
              message: error.message
            });
            return;
          }
          sendResponse({
            ok: false,
            message: error instanceof Error ? error.message : "Validation failed"
          });
        }
        return;
      }
      case "set-user-spend-limit": {
        const config = await storage.getConfig();
        const client = new CursorApiClient(config.apiKey);
        const result = await client.setUserSpendLimit(message.payload);
        sendResponse(result);
        return;
      }
      default: {
        sendResponse({ error: "지원하지 않는 메시지 타입입니다." });
      }
    }
  })().catch((error) => {
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  });
  return true;
});
