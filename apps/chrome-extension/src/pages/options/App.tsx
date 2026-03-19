import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CONFIG,
  EMPTY_SNAPSHOT,
  formatUsdWithApproxKrw,
  getUsageSummary,
  percent,
  type AppConfig,
  type SetUserSpendLimitRequest,
  type SyncSnapshot
} from "@cursor-usage/core";

import type {
  BackgroundMessage,
  RuntimePushMessage,
  StateMessagePayload
} from "../../background/messages";
import { transitionTab, type OptionsTabKey } from "./tabState";

type UiLanguage = "ko" | "en";

type KeyValidationState = {
  tone: "success" | "error" | "warn" | "info";
  message: string;
};

type ValidateApiKeyResponse = {
  ok: boolean;
  mode?: "mock";
  status?: number;
  message?: string;
};

const UI_LANGUAGE_STORAGE_KEY = "cue_ui_language_chrome";
const TABS: OptionsTabKey[] = ["overview", "team", "settings"];

const I18N = {
  ko: {
    loading: "로딩 중...",
    refresh: "새로고침",
    tabs: {
      overview: "Summary",
      team: "Team",
      settings: "Settings"
    },
    syncSuccess: "동기화 완료",
    syncFailed: "동기화 실패",
    initialSyncFailed: "초기 동기화 실패",
    saveSuccess: "설정 저장 완료",
    saveFailed: "저장 실패",
    limitNeedsInteger: "한도는 정수 또는 null 값이어야 합니다.",
    apiAndEmailRequired: "저장된 API Key와 사용자 이메일을 확인해주세요.",
    limitApplySuccess: "사용자 한도 적용 완료",
    limitApplyFailed: "사용자 한도 적용 실패",
    myUsage: "개인 사용률",
    teamUsage: "팀 사용률",
    myNoData: "개인 데이터 없음",
    teamNoData: "팀 데이터 없음",
    myLimit: "개인 한도",
    teamBudget: "팀 예산",
    teamNoRows: "팀 데이터가 없습니다.",
    userLimitTitle: "사용자 한도 설정",
    userLimitHint: "한도 해제는 `null` 입력",
    userLimitApply: "한도 적용",
    settingsBase: "기본 연동",
    settingsThresholdAlert: "임계치 및 알림",
    settingsTheme: "테마",
    apiKeyLabel: "Cursor API Key",
    validateButton: "인증하기",
    validating: "인증 중...",
    mockHint: "테스트 모드: API Key에 `mock_demo`를 입력 후 저장하면 목업 사용량/비용이 표시됩니다.",
    myEmailLabel: "내 이메일",
    teamBudgetLabel: "팀 월예산 (USD)",
    personalThresholdLabel: "개인 임계치 (%)",
    teamThresholdLabel: "팀 임계치 (%)",
    resendApiKeyLabel: "Resend API Key",
    resendFromLabel: "Resend 발신자",
    emailRecipientsLabel: "이메일 수신자 (줄바꿈/쉼표)",
    teamsWebhookLabel: "Teams Webhook URL (줄바꿈/쉼표)",
    displayModeLabel: "표시 모드",
    themeSystem: "시스템",
    themeLight: "라이트",
    themeDark: "다크",
    saveSettings: "설정 저장",
    savingSettings: "저장 중...",
    autoSync: "5분/1시간 자동 동기화",
    enterpriseBanner: "Enterprise 권한이 필요합니다. Admin API 접근 권한(API Key/플랜)을 확인해주세요.",
    keyEmpty: "먼저 Cursor API Key를 입력해주세요.",
    keyChecking: "API Key 인증 중...",
    keyValid: "유효한 API Key입니다.",
    keyMockMode: "목업 모드 키가 확인되었습니다. 실제 API 호출 없이 테스트 데이터가 로드됩니다.",
    keyInvalid: "API Key가 유효하지 않습니다. 값을 다시 확인해주세요.",
    keyNoEnterprise: "키는 인식되지만 Admin API 권한(Enterprise)이 없어 조회가 제한됩니다.",
    keyRateLimited: "요청이 많습니다. 잠시 후 다시 인증해주세요.",
    keyFailedWithStatus: "인증 실패",
    keyFailed: "API Key 인증에 실패했습니다.",
    apiKeyPlaceholder: "예: cu_live_xxxxxxxxxxxxx",
    myEmailPlaceholder: "예: you@company.com",
    teamBudgetPlaceholder: "예: 5000",
    userEmailPlaceholder: "예: developer@company.com",
    userLimitPlaceholder: "예: 120 또는 null",
    personalThresholdPlaceholder: "기본 80",
    teamThresholdPlaceholder: "기본 80",
    resendApiKeyPlaceholder: "re_xxxxxxxxxxxxx",
    resendFromPlaceholder: "예: billing@yourcompany.com",
    emailRecipientsPlaceholder: "dev@company.com\nlead@company.com",
    teamsWebhookPlaceholder: "https://outlook.office.com/webhook/...\nhttps://outlook.office.com/webhook/..."
  },
  en: {
    loading: "Loading...",
    refresh: "Refresh",
    tabs: {
      overview: "Summary",
      team: "Team",
      settings: "Settings"
    },
    syncSuccess: "Sync completed",
    syncFailed: "Sync failed",
    initialSyncFailed: "Initial sync failed",
    saveSuccess: "Settings saved",
    saveFailed: "Save failed",
    limitNeedsInteger: "Spend limit must be an integer or null.",
    apiAndEmailRequired: "Please check saved API key and user email.",
    limitApplySuccess: "User spend limit applied",
    limitApplyFailed: "Failed to apply user spend limit",
    myUsage: "My Usage",
    teamUsage: "Team Usage",
    myNoData: "No personal data",
    teamNoData: "No team data",
    myLimit: "My Limit",
    teamBudget: "Team Budget",
    teamNoRows: "No team data available.",
    userLimitTitle: "Set User Spend Limit",
    userLimitHint: "Use `null` to clear the limit",
    userLimitApply: "Apply Limit",
    settingsBase: "Basic Integration",
    settingsThresholdAlert: "Thresholds & Alerts",
    settingsTheme: "Theme",
    apiKeyLabel: "Cursor API Key",
    validateButton: "Validate",
    validating: "Validating...",
    mockHint: "Test mode: use `mock_demo` as API key, save, then mock usage/spend data will load.",
    myEmailLabel: "My Email",
    teamBudgetLabel: "Team Monthly Budget (USD)",
    personalThresholdLabel: "Personal Threshold (%)",
    teamThresholdLabel: "Team Threshold (%)",
    resendApiKeyLabel: "Resend API Key",
    resendFromLabel: "Resend From",
    emailRecipientsLabel: "Email Recipients (newline/comma)",
    teamsWebhookLabel: "Teams Webhook URL (newline/comma)",
    displayModeLabel: "Display Mode",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    saveSettings: "Save Settings",
    savingSettings: "Saving...",
    autoSync: "Auto sync every 5m/1h",
    enterpriseBanner:
      "Enterprise permission is required. Please check Admin API access (API key/plan).",
    keyEmpty: "Please enter a Cursor API Key first.",
    keyChecking: "Validating API key...",
    keyValid: "This API key is valid.",
    keyMockMode: "Mock mode key validated. Test data will load without real API calls.",
    keyInvalid: "This API key is invalid. Please check again.",
    keyNoEnterprise:
      "Key is recognized, but Admin API access is restricted without Enterprise permission.",
    keyRateLimited: "Too many requests. Please try again in a moment.",
    keyFailedWithStatus: "Validation failed",
    keyFailed: "Failed to validate API key.",
    apiKeyPlaceholder: "e.g. cu_live_xxxxxxxxxxxxx",
    myEmailPlaceholder: "e.g. you@company.com",
    teamBudgetPlaceholder: "e.g. 5000",
    userEmailPlaceholder: "e.g. developer@company.com",
    userLimitPlaceholder: "e.g. 120 or null",
    personalThresholdPlaceholder: "default 80",
    teamThresholdPlaceholder: "default 80",
    resendApiKeyPlaceholder: "re_xxxxxxxxxxxxx",
    resendFromPlaceholder: "e.g. billing@yourcompany.com",
    emailRecipientsPlaceholder: "dev@company.com\nlead@company.com",
    teamsWebhookPlaceholder:
      "https://outlook.office.com/webhook/...\nhttps://outlook.office.com/webhook/..."
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

function clamp(value: number | null): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function listToText(values: string[]): string {
  return values.join("\n");
}

function textToList(value: string): string[] {
  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableBudget(value: string, fallback: number | null): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseThreshold(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(100, parsed));
}

function isConfigEqual(a: AppConfig, b: AppConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function RingGauge(props: {
  label: string;
  percent: number | null;
  subtitle: string;
  tone: "primary" | "success";
}): JSX.Element {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safePercent = clamp(props.percent);
  const dashOffset = circumference - (safePercent / 100) * circumference;

  return (
    <article className="ring-card">
      <svg className="ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle className="ring-track" cx="60" cy="60" r={radius} />
        <circle
          className={`ring-progress ${props.tone}`}
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.3em" className="ring-text">
          {props.percent === null ? "--" : `${safePercent.toFixed(0)}%`}
        </text>
      </svg>
      <p className="ring-label">{props.label}</p>
      <p className="ring-subtitle">{props.subtitle}</p>
    </article>
  );
}

export function OptionsApp(): JSX.Element {
  const [tab, setTab] = useState<OptionsTabKey>("overview");
  const [language, setLanguage] = useState<UiLanguage>(() => getInitialLanguage());
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY_SNAPSHOT);
  const [draft, setDraft] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValidation, setKeyValidation] = useState<KeyValidationState | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLimit, setAdminLimit] = useState("");
  const draftDirtyRef = useRef(false);
  const i18n = I18N[language];

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    void sendMessage<StateMessagePayload>({ type: "get-state" })
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setConfig(payload.config);
        setDraft(payload.config);
        setSnapshot(payload.snapshot);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setFeedback(error instanceof Error ? error.message : i18n.initialSyncFailed);
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
      setConfig(message.payload.config);
      setSnapshot(message.payload.snapshot);
      if (!draftDirtyRef.current) {
        setDraft(message.payload.config);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [i18n.initialSyncFailed]);

  useEffect(() => {
    draftDirtyRef.current = !isConfigEqual(draft, config);
  }, [draft, config]);

  useEffect(() => {
    document.documentElement.dataset.theme = draft.theme;
  }, [draft.theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage write errors
    }
  }, [language]);

  const summary = useMemo(
    () => getUsageSummary(snapshot.spend, config.myEmail, config.teamBudgetUsd),
    [snapshot.spend, config.myEmail, config.teamBudgetUsd]
  );

  const myPercent = percent(summary.mySpendUsd, summary.myLimitUsd);
  const teamPercent = percent(summary.teamSpendUsd, summary.teamBudgetUsd);

  const topMembers = useMemo(() => {
    return (snapshot.spend?.teamMemberSpend ?? [])
      .slice()
      .sort((a, b) => b.overallSpendCents - a.overallSpendCents)
      .slice(0, 8)
      .map((member) => ({
        email: member.email,
        name: member.name ?? member.email,
        usd: member.overallSpendCents / 100
      }));
  }, [snapshot.spend]);

  const tabIndex = Math.max(0, TABS.findIndex((item) => item === tab));

  const onManualSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const next = await sendMessage<SyncSnapshot>({ type: "manual-sync" });
      setSnapshot(next);
      setFeedback(i18n.syncSuccess);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : i18n.syncFailed);
    } finally {
      setSyncing(false);
    }
  };

  const onSaveConfig = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = await sendMessage<StateMessagePayload>({
        type: "save-config",
        payload: draft
      });
      setConfig(payload.config);
      setDraft(payload.config);
      setSnapshot(payload.snapshot);
      setFeedback(i18n.saveSuccess);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : i18n.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const onSetUserLimit = async () => {
    const value = adminLimit.trim();
    const spendLimitDollars =
      value.length === 0 || value.toLowerCase() === "null" ? null : Number.parseInt(value, 10);
    if (value.length > 0 && Number.isNaN(spendLimitDollars)) {
      setFeedback(i18n.limitNeedsInteger);
      return;
    }

    const request: SetUserSpendLimitRequest = {
      userEmail: adminEmail.trim(),
      spendLimitDollars
    };
    if (!request.userEmail || !config.apiKey.trim()) {
      setFeedback(i18n.apiAndEmailRequired);
      return;
    }

    try {
      const result = await sendMessage<{ message?: string }>({
        type: "set-user-spend-limit",
        payload: request
      });
      setFeedback(result.message ?? i18n.limitApplySuccess);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : i18n.limitApplyFailed);
    }
  };

  const onValidateApiKey = async () => {
    const apiKey = draft.apiKey.trim();
    if (!apiKey) {
      setKeyValidation({
        tone: "error",
        message: i18n.keyEmpty
      });
      return;
    }

    setValidatingKey(true);
    setKeyValidation({
      tone: "info",
      message: i18n.keyChecking
    });

    try {
      const result = await sendMessage<ValidateApiKeyResponse>({
        type: "validate-api-key",
        payload: { apiKey }
      });
      if (result.ok) {
        setKeyValidation({
          tone: "success",
          message: result.mode === "mock" ? i18n.keyMockMode : i18n.keyValid
        });
        return;
      }
      if (result.status === 401) {
        setKeyValidation({
          tone: "error",
          message: i18n.keyInvalid
        });
        return;
      }
      if (result.status === 403) {
        setKeyValidation({
          tone: "warn",
          message: i18n.keyNoEnterprise
        });
        return;
      }
      if (result.status === 429) {
        setKeyValidation({
          tone: "warn",
          message: i18n.keyRateLimited
        });
        return;
      }
      setKeyValidation({
        tone: "error",
        message: `${i18n.keyFailedWithStatus}${result.status ? ` (${result.status})` : ""}: ${result.message ?? i18n.keyFailed}`
      });
    } catch (error) {
      setKeyValidation({
        tone: "error",
        message: error instanceof Error ? error.message : i18n.keyFailed
      });
    } finally {
      setValidatingKey(false);
    }
  };

  const setListField = (field: "emailRecipients" | "teamsWebhooks", text: string) => {
    setDraft((prev: AppConfig) => ({
      ...prev,
      alertChannels: {
        ...prev.alertChannels,
        [field]: textToList(text)
      }
    }));
  };

  if (loading) {
    return (
      <div className="options-root">
        <section className="options-shell">
          <div className="content-panel loading-panel">{i18n.loading}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="options-root">
      <section className="options-shell">
        <header className="options-header">
          <div className="brand">
            <img src={chrome.runtime.getURL("icons/cursor-48.png")} alt="Cursor" />
            <div>
              <h1>Cursor Usage</h1>
              <p>v1.0.0 by TAEINN</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="lang-switch" role="group" aria-label="Language switch">
              <button
                className={`lang-btn ${language === "ko" ? "active" : ""}`}
                onClick={() => setLanguage("ko")}
              >
                KO
              </button>
              <button
                className={`lang-btn ${language === "en" ? "active" : ""}`}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <button className="mini-btn" onClick={onManualSync} disabled={syncing}>
              {syncing ? "..." : i18n.refresh}
            </button>
          </div>
        </header>

        {snapshot.enterpriseRestricted ? <p className="options-feedback">{i18n.enterpriseBanner}</p> : null}
        {feedback ? <p className="options-feedback">{feedback}</p> : null}

        <nav className="options-tabs">
          <span className="tab-indicator" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
          {TABS.map((tabKey) => (
            <button
              key={tabKey}
              className={`options-tab ${tab === tabKey ? "active" : ""}`}
              onClick={() => {
                const transition = transitionTab(tabKey);
                setTab(transition.nextTab);
              }}
            >
              {i18n.tabs[tabKey]}
            </button>
          ))}
        </nav>

        <section className="content-area">
          {tab === "overview" ? (
            <div className="content-panel">
              <div className="ring-grid">
                <RingGauge
                  label={i18n.myUsage}
                  percent={myPercent}
                  tone="primary"
                  subtitle={
                    summary.mySpendUsd === null
                      ? i18n.myNoData
                      : formatUsdWithApproxKrw(summary.mySpendUsd, snapshot.fxRate?.usdToKrw ?? null)
                  }
                />
                <RingGauge
                  label={i18n.teamUsage}
                  percent={teamPercent}
                  tone="success"
                  subtitle={
                    summary.teamSpendUsd === null
                      ? i18n.teamNoData
                      : formatUsdWithApproxKrw(summary.teamSpendUsd, snapshot.fxRate?.usdToKrw ?? null)
                  }
                />
              </div>

              <div className="mini-metrics">
                <div>
                  <strong>{i18n.myLimit}</strong>
                  <p>
                    {summary.myLimitUsd === null
                      ? "-"
                      : formatUsdWithApproxKrw(summary.myLimitUsd, snapshot.fxRate?.usdToKrw ?? null)}
                  </p>
                </div>
                <div>
                  <strong>{i18n.teamBudget}</strong>
                  <p>
                    {summary.teamBudgetUsd === null
                      ? "-"
                      : formatUsdWithApproxKrw(summary.teamBudgetUsd, snapshot.fxRate?.usdToKrw ?? null)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "team" ? (
            <div className="content-panel">
              <div className="mini-list">
                {topMembers.length === 0 ? (
                  <p className="empty">{i18n.teamNoRows}</p>
                ) : (
                  topMembers.map((member) => (
                    <article className="mini-item" key={member.email}>
                      <div>
                        <strong>{member.name}</strong>
                        <p>{member.email}</p>
                      </div>
                      <span>{formatUsdWithApproxKrw(member.usd, snapshot.fxRate?.usdToKrw ?? null)}</span>
                    </article>
                  ))
                )}
              </div>

              <section className="mini-admin-card">
                <h3>{i18n.userLimitTitle}</h3>
                <p>{i18n.userLimitHint}</p>
                <div className="admin-inline">
                  <input
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder={i18n.userEmailPlaceholder}
                  />
                  <input
                    value={adminLimit}
                    onChange={(event) => setAdminLimit(event.target.value)}
                    placeholder={i18n.userLimitPlaceholder}
                  />
                  <button className="mini-btn" onClick={onSetUserLimit}>
                    {i18n.userLimitApply}
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className="content-panel settings-panel">
              <div className="settings-scroll">
                <div className="compact-form">
                  <section className="settings-section">
                    <h3>{i18n.settingsBase}</h3>
                    <label>{i18n.apiKeyLabel}</label>
                    <div className="key-input-row">
                      <input
                        type="password"
                        value={draft.apiKey}
                        placeholder={i18n.apiKeyPlaceholder}
                        onChange={(event) => {
                          setDraft({ ...draft, apiKey: event.target.value });
                          setKeyValidation(null);
                        }}
                      />
                      <button
                        className="mini-btn key-verify-btn"
                        onClick={onValidateApiKey}
                        disabled={validatingKey}
                      >
                        {validatingKey ? i18n.validating : i18n.validateButton}
                      </button>
                    </div>
                    <p className="key-validation info">{i18n.mockHint}</p>
                    {keyValidation ? (
                      <p className={`key-validation ${keyValidation.tone}`}>{keyValidation.message}</p>
                    ) : null}

                    <label>{i18n.myEmailLabel}</label>
                    <input
                      value={draft.myEmail}
                      placeholder={i18n.myEmailPlaceholder}
                      onChange={(event) => setDraft({ ...draft, myEmail: event.target.value })}
                    />

                    <label>{i18n.teamBudgetLabel}</label>
                    <input
                      inputMode="decimal"
                      value={draft.teamBudgetUsd ?? ""}
                      placeholder={i18n.teamBudgetPlaceholder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          teamBudgetUsd: parseNullableBudget(event.target.value, draft.teamBudgetUsd)
                        })
                      }
                    />
                  </section>

                  <section className="settings-section">
                    <h3>{i18n.settingsThresholdAlert}</h3>
                    <label>{i18n.personalThresholdLabel}</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={draft.thresholds.personalPercent}
                      placeholder={i18n.personalThresholdPlaceholder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          thresholds: {
                            ...draft.thresholds,
                            personalPercent: parseThreshold(
                              event.target.value,
                              draft.thresholds.personalPercent
                            )
                          }
                        })
                      }
                    />

                    <label>{i18n.teamThresholdLabel}</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={draft.thresholds.teamPercent}
                      placeholder={i18n.teamThresholdPlaceholder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          thresholds: {
                            ...draft.thresholds,
                            teamPercent: parseThreshold(event.target.value, draft.thresholds.teamPercent)
                          }
                        })
                      }
                    />

                    <label>{i18n.resendApiKeyLabel}</label>
                    <input
                      type="password"
                      value={draft.alertChannels.resendApiKey}
                      placeholder={i18n.resendApiKeyPlaceholder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          alertChannels: {
                            ...draft.alertChannels,
                            resendApiKey: event.target.value
                          }
                        })
                      }
                    />

                    <label>{i18n.resendFromLabel}</label>
                    <input
                      value={draft.alertChannels.resendFrom}
                      placeholder={i18n.resendFromPlaceholder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          alertChannels: {
                            ...draft.alertChannels,
                            resendFrom: event.target.value
                          }
                        })
                      }
                    />

                    <label>{i18n.emailRecipientsLabel}</label>
                    <textarea
                      value={listToText(draft.alertChannels.emailRecipients)}
                      placeholder={i18n.emailRecipientsPlaceholder}
                      onChange={(event) => setListField("emailRecipients", event.target.value)}
                    />

                    <label>{i18n.teamsWebhookLabel}</label>
                    <textarea
                      value={listToText(draft.alertChannels.teamsWebhooks)}
                      placeholder={i18n.teamsWebhookPlaceholder}
                      onChange={(event) => setListField("teamsWebhooks", event.target.value)}
                    />
                  </section>

                  <section className="settings-section">
                    <h3>{i18n.settingsTheme}</h3>
                    <label>{i18n.displayModeLabel}</label>
                    <select
                      value={draft.theme}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          theme: event.target.value as AppConfig["theme"]
                        })
                      }
                    >
                      <option value="system">{i18n.themeSystem}</option>
                      <option value="light">{i18n.themeLight}</option>
                      <option value="dark">{i18n.themeDark}</option>
                    </select>
                  </section>
                </div>
              </div>

              <div className="settings-save-bar">
                <button className="mini-btn primary save-btn" onClick={onSaveConfig} disabled={saving}>
                  {saving ? i18n.savingSettings : i18n.saveSettings}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <footer className="options-footer">
          <span>{i18n.autoSync}</span>
          <span>{snapshot.lastSyncAt ? new Date(snapshot.lastSyncAt).toLocaleString() : "-"}</span>
        </footer>
      </section>
    </div>
  );
}
