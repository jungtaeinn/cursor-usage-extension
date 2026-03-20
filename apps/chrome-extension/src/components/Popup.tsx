import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CONFIG,
  EMPTY_SNAPSHOT,
  formatUsdWithApproxKrw,
  getUsageSummary,
  percent,
  type AppConfig,
  type SyncSnapshot
} from "@cursor-usage/core";

import type { BackgroundMessage, RuntimePushMessage, StateMessagePayload } from "../background/messages";

type PopupState = {
  config: AppConfig;
  snapshot: SyncSnapshot;
};

type UiLanguage = "ko" | "en";

const APP_VERSION = "1.1.1";
const UI_LANGUAGE_STORAGE_KEY = "cue_ui_language_chrome";
const FEEDBACK_AUTO_HIDE_MS = 5_000;

const I18N = {
  ko: {
    loading: "로딩 중...",
    refresh: "새로고침",
    openDashboard: "Dashboard 열기",
    title: "남은 개인 사용량",
    subtitle: "개인 한도 기준 실시간 잔여량",
    noData: "개인 한도/사용량 데이터 없음",
    used: "사용",
    remaining: "남음",
    autoSync: "5분/1시간 자동 동기화"
  },
  en: {
    loading: "Loading...",
    refresh: "Refresh",
    openDashboard: "Open Dashboard",
    title: "Personal Remaining Usage",
    subtitle: "Live remaining amount based on personal limit",
    noData: "No personal limit/usage data",
    used: "Used",
    remaining: "Remaining",
    autoSync: "Auto sync every 5m/1h"
  }
} as const;

function getInitialLanguage(): UiLanguage {
  try {
    const saved = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (saved === "ko" || saved === "en") {
      return saved;
    }
  } catch {
    return "ko";
  }
  return "ko";
}

function clamp(value: number | null): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function getRemainingTone(
  value: number | null
): "tone-muted" | "tone-blue" | "tone-green" | "tone-orange" | "tone-red" {
  if (value === null) {
    return "tone-muted";
  }
  if (value >= 80) {
    return "tone-blue";
  }
  if (value >= 60) {
    return "tone-green";
  }
  if (value >= 20) {
    return "tone-orange";
  }
  return "tone-red";
}

function sendMessage<T>(message: BackgroundMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T | { error?: string }) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (
        response &&
        typeof response === "object" &&
        "error" in response &&
        typeof response.error === "string"
      ) {
        reject(new Error(response.error));
        return;
      }
      resolve(response as T);
    });
  });
}

export function Popup(): JSX.Element {
  const [language, setLanguage] = useState<UiLanguage>(() => getInitialLanguage());
  const [state, setState] = useState<PopupState>({
    config: DEFAULT_CONFIG,
    snapshot: EMPTY_SNAPSHOT
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const i18n = I18N[language];

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    void sendMessage<StateMessagePayload>({ type: "get-state" })
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setState(payload);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const listener = (message: RuntimePushMessage) => {
      if (message.type !== "state-updated") {
        return;
      }
      setState(message.payload);
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, FEEDBACK_AUTO_HIDE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.config.theme;
  }, [state.config.theme]);

  const summary = useMemo(
    () => getUsageSummary(state.snapshot.spend, state.config.myEmail, state.config.teamBudgetUsd),
    [state.snapshot.spend, state.config.myEmail, state.config.teamBudgetUsd]
  );

  const myPercent = percent(summary.mySpendUsd, summary.myLimitUsd);
  const safeMyPercent = clamp(myPercent);
  const remainingMyPercent = myPercent === null ? null : Math.max(0, 100 - myPercent);
  const remainingToneClass = getRemainingTone(remainingMyPercent);
  const remainingMyUsd =
    summary.myLimitUsd !== null && summary.mySpendUsd !== null
      ? Math.max(0, summary.myLimitUsd - summary.mySpendUsd)
      : null;
  const lastSyncedAtLabel = state.snapshot.lastSyncAt
    ? new Date(state.snapshot.lastSyncAt).toLocaleTimeString()
    : "-";

  const openDashboard = async () => {
    const url = chrome.runtime.getURL("options.html");
    await chrome.tabs.create({ url });
  };

  const onManualSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const snapshot = await sendMessage<SyncSnapshot>({ type: "manual-sync" });
      setState((prev) => ({ ...prev, snapshot }));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="popup-root">
      <header className="popup-header">
        <div className="brand">
          <img src={chrome.runtime.getURL("icons/cursor-48.png")} alt="Cursor" />
          <div>
            <h1>Cursor Teams Usage</h1>
            <p>{`v${APP_VERSION} by TAEINN`}</p>
          </div>
        </div>
        <button className="mini-btn" onClick={onManualSync} disabled={syncing}>
          {syncing ? "..." : i18n.refresh}
        </button>
      </header>

      <article className="popup-card">
        {loading ? (
          <p className="muted">{i18n.loading}</p>
        ) : (
          <section className="mini-mode-panel">
            <div className="mini-mode-head">
              <div>
                <p className="mini-mode-title">{i18n.title}</p>
                <p className="mini-mode-subtitle">{i18n.subtitle}</p>
              </div>
              <span className={`mini-remaining-chip ${remainingToneClass}`}>
                {remainingMyPercent === null ? "-" : `${remainingMyPercent.toFixed(0)}%`} {i18n.remaining}
              </span>
            </div>
            <div className="mini-mode-amount-wrap">
              <p className="mini-mode-amount">
                {remainingMyUsd === null
                  ? i18n.noData
                  : formatUsdWithApproxKrw(remainingMyUsd, state.snapshot.fxRate?.usdToKrw ?? null)}
              </p>
            </div>
            <div
              className="mini-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.mySpendUsd === null ? 0 : safeMyPercent}
            >
              <span className="mini-progress-used" style={{ width: `${safeMyPercent}%` }} />
            </div>
            <div className="mini-progress-meta">
              <span>
                {i18n.used}:{" "}
                {summary.mySpendUsd === null
                  ? "-"
                  : formatUsdWithApproxKrw(summary.mySpendUsd, state.snapshot.fxRate?.usdToKrw ?? null)}
              </span>
            </div>
          </section>
        )}
      </article>

      <div className="popup-actions">
        <button className="mini-btn primary" onClick={openDashboard}>
          {i18n.openDashboard}
        </button>
        <p className="muted popup-sync-time">
          {`${i18n.autoSync} (${lastSyncedAtLabel})`}
        </p>
      </div>

      <p className={`options-feedback ${feedback ? "" : "is-empty"}`}>{feedback ?? ""}</p>
    </div>
  );
}
