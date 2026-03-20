import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import {
  createMockSetUserSpendLimitResponse,
  CursorApiClient,
  CursorApiError,
  DEFAULT_CONFIG,
  EMPTY_SNAPSHOT,
  SyncService,
  formatUsdWithApproxKrw,
  formatKoreanDisplayName,
  getUsageSummary,
  isMockApiKey,
  percent,
  resolveMemberSpendUsd,
  type AppConfig,
  type SetUserSpendLimitRequest,
  type SyncSnapshot
} from "@cursor-usage/core";

import { DesktopStorageAdapter } from "./storage";
import { DAILY_USAGE_SYNC_MINUTES, SPEND_SYNC_MINUTES } from "./syncPolicy";
import {
  appendAuthValidationLog,
  classifyAuthValidationError,
  createTraceId,
  fingerprintApiKey
} from "./authDebug";

type TabKey = "overview" | "team" | "settings";

type UiLanguage = "ko" | "en";
type WindowMode = "max" | "mini";

const UI_LANGUAGE_STORAGE_KEY = "cue_ui_language";
const WINDOW_MODE_STORAGE_KEY = "cue_window_mode";
const TABS: TabKey[] = ["overview", "team", "settings"];
const APP_VERSION = "1.1.1";
const WINDOW_WIDTH = 430;
const MAX_WINDOW_HEIGHT = 600;
const MINI_WINDOW_HEIGHT_WITH_FEEDBACK = 264;
const CURSOR_API_DEV_PROXY_BASE_URL = "/cursor-api";
const AUTH_VALIDATE_ENDPOINT = "/teams/spend";
const FEEDBACK_AUTO_HIDE_MS = 5_000;

const I18N = {
  ko: {
    loading: "로딩 중...",
    refresh: "새로고침",
    hideWindow: "앱 숨기기",
    switchToMini: "미니 모드",
    switchToMax: "맥스 모드",
    miniModeTitle: "남은 개인 사용량",
    miniModeSubtitle: "개인 한도 기준 실시간 잔여량",
    miniUsedLabel: "사용",
    miniRemainingLabel: "남음",
    miniNoData: "개인 한도/사용량 데이터 없음",
    tabs: {
      overview: "요약",
      team: "팀",
      settings: "설정"
    },
    syncSuccess: "동기화 완료",
    syncFailed: "동기화 실패",
    initialSyncFailed: "초기 동기화 실패",
    saveSuccess: "설정 저장 완료",
    saveFailed: "저장 실패",
    limitNeedsInteger: "한도는 정수 또는 null 값이어야 합니다.",
    apiAndEmailRequired: "API Key와 사용자 이메일을 확인해주세요.",
    limitApplySuccess: "사용자 한도 적용 완료",
    limitApplyFailed: "사용자 한도 적용 실패",
    myUsage: "개인 사용률",
    teamUsage: "팀 사용률",
    myUsagePair: "개인 사용/한도",
    teamUsagePair: "팀 사용/예산",
    myNoData: "개인 데이터 없음",
    myEmailNotConfigured: "설정 탭에서 내 이메일을 먼저 입력해주세요.",
    myEmailAutoSet: "개인 사용률 조회를 위해 내 이메일을 자동 설정했습니다.",
    myLimitNotConfigured: "개인 한도 미설정",
    teamNoData: "팀 데이터 없음",
    usageEvents24h: "최근 24시간 Usage Events",
    usageEventsNoData: "Usage Events 데이터 없음",
    usageEventsApiFailed: "Usage Events API 응답 오류로 데이터를 불러오지 못했습니다.",
    usageEventsCount: "이벤트 수",
    usageEventsTokens: "토큰 (입력/출력)",
    tokensApiFailed: "토큰 데이터 조회 실패",
    myUsageInfo:
      "내 이메일과 같은 계정이 이번 달(현재 결제 주기)에 사용한 금액입니다. 퍼센트는 내 한도 대비 현재 사용 비율입니다.",
    teamUsageInfo:
      "팀원 전체가 이번 달(현재 결제 주기)에 사용한 금액의 합계입니다. 퍼센트는 설정한 팀 예산 대비 현재 사용 비율입니다.",
    usageEventsInfo:
      "지난 24시간 동안 팀에서 발생한 AI 사용 기록의 비용 합계입니다. 요청 1건을 이벤트 1개로 보고, 그 비용을 모두 더해 보여줍니다.",
    tokensInfo:
      "지난 24시간 이벤트 기준 토큰 합계입니다. 왼쪽은 입력 토큰, 오른쪽은 출력 토큰입니다. 데이터가 없거나 조회에 실패하면 '-'로 표시됩니다.",
    infoClose: "닫기",
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
    showApiKey: "API Key 보기",
    hideApiKey: "API Key 숨기기",
    mockHint: "테스트 모드: API Key에 `mock_demo`를 입력 후 저장하면 목업 사용량/비용이 표시됩니다.",
    validationHint: "저장 전에도 즉시 유효성 검증이 가능합니다.",
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
    hideWindow: "Hide app",
    switchToMini: "Mini mode",
    switchToMax: "Max mode",
    miniModeTitle: "Personal Remaining Usage",
    miniModeSubtitle: "Live remaining amount based on personal limit",
    miniUsedLabel: "Used",
    miniRemainingLabel: "Remaining",
    miniNoData: "No personal limit/usage data",
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
    apiAndEmailRequired: "Please check API key and user email.",
    limitApplySuccess: "User spend limit applied",
    limitApplyFailed: "Failed to apply user spend limit",
    myUsage: "My Usage",
    teamUsage: "Team Usage",
    myUsagePair: "My Spend / Limit",
    teamUsagePair: "Team Spend / Budget",
    myNoData: "No personal data",
    myEmailNotConfigured: "Set your My Email in Settings first.",
    myEmailAutoSet: "Your My Email was auto-set for personal usage tracking.",
    myLimitNotConfigured: "Personal limit not set",
    teamNoData: "No team data",
    usageEvents24h: "Usage Events (24h)",
    usageEventsNoData: "No usage events data",
    usageEventsApiFailed: "Could not load usage events due to API response error.",
    usageEventsCount: "Events",
    usageEventsTokens: "Tokens (in/out)",
    tokensApiFailed: "Token data unavailable",
    myUsageInfo:
      "How much your account (matched by My Email) has spent in the current billing cycle. Percent means how much of your personal limit is used.",
    teamUsageInfo:
      "Total spend of all team members in the current billing cycle. Percent means how much of your configured team budget is used.",
    usageEventsInfo:
      "Total cost of AI usage records from the last 24 hours. Each request is treated as one event, and this card shows the sum of their charges.",
    tokensInfo:
      "Token totals from the last 24h events. Left is input tokens, right is output tokens. If data is unavailable or loading fails, this shows '-'.",
    infoClose: "Close",
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
    showApiKey: "Show API key",
    hideApiKey: "Hide API key",
    mockHint: "Test mode: use `mock_demo` as API key, save, then mock usage/spend data will load.",
    validationHint: "You can validate the key instantly before saving.",
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

function getInitialWindowMode(): WindowMode {
  try {
    const saved = window.localStorage.getItem(WINDOW_MODE_STORAGE_KEY);
    if (saved === "max" || saved === "mini") {
      return saved;
    }
  } catch {
    return "max";
  }
  return "max";
}

function isTauriRuntime(): boolean {
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

async function applyWindowSize(mode: WindowMode): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const height = mode === "mini" ? MINI_WINDOW_HEIGHT_WITH_FEEDBACK : MAX_WINDOW_HEIGHT;
  try {
    await invoke("set_window_mode", { mode, height });
    return;
  } catch {
    // fallback to direct window API if command is unavailable
  }
  await getCurrentWindow().setSize(new LogicalSize(WINDOW_WIDTH, height));
}

async function hideCurrentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  try {
    await invoke("hide_main_window");
    return;
  } catch {
    // fallback to direct window API if command is unavailable
  }
  await getCurrentWindow().hide();
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

function getUsageTone(
  value: number | null
): "tone-muted" | "tone-blue" | "tone-green" | "tone-orange" | "tone-red" {
  if (value === null) {
    return "tone-muted";
  }
  if (value >= 90) {
    return "tone-red";
  }
  if (value >= 70) {
    return "tone-orange";
  }
  if (value >= 40) {
    return "tone-blue";
  }
  return "tone-green";
}

function InfoHint(props: {
  label: string;
  onOpen: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="info-hint"
      aria-label={`${props.label} info`}
      title={props.label}
      onClick={props.onOpen}
    >
      i
    </button>
  );
}

function RingGauge(props: {
  label: string;
  percent: number | null;
  subtitle: string;
  onInfoClick: () => void;
}): JSX.Element {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safePercent = clamp(props.percent);
  const dashOffset = circumference - (safePercent / 100) * circumference;
  const usageTone = getUsageTone(props.percent);

  return (
    <article className="ring-card">
      <svg className="ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle className="ring-track" cx="60" cy="60" r={radius} />
        <circle
          className={`ring-progress ${usageTone}`}
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.3em" className={`ring-text ${usageTone}`}>
          {props.percent === null ? "--" : `${safePercent.toFixed(0)}%`}
        </text>
      </svg>
      <p className="ring-label">{props.label}</p>
      <p className="ring-subtitle">{props.subtitle}</p>
      <InfoHint label={props.label} onOpen={props.onInfoClick} />
    </article>
  );
}

function VisibilityIcon(props: { masked: boolean }): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 12C4.7 7.8 8 6 12 6C16 6 19.3 7.8 22 12C19.3 16.2 16 18 12 18C8 18 4.7 16.2 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      {props.masked ? null : (
        <path
          d="M4 4L20 20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
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

function applyMockDefaults(config: AppConfig): AppConfig {
  if (!isMockApiKey(config.apiKey)) {
    return config;
  }

  return {
    ...config,
    myEmail: config.myEmail.trim() ? config.myEmail : "taeinn@company.com",
    teamBudgetUsd: config.teamBudgetUsd ?? 1200
  };
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<TabKey>("overview");
  const [language, setLanguage] = useState<UiLanguage>(() => getInitialLanguage());
  const [windowMode, setWindowMode] = useState<WindowMode>(() => getInitialWindowMode());
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY_SNAPSHOT);
  const [draft, setDraft] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<{ label: string; content: string } | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyValidation, setKeyValidation] = useState<{
    tone: "success" | "error" | "warn" | "info";
    message: string;
  } | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLimit, setAdminLimit] = useState("");

  const storage = useMemo(() => new DesktopStorageAdapter(), []);
  const cursorApiBaseUrl = import.meta.env.DEV ? CURSOR_API_DEV_PROXY_BASE_URL : undefined;
  const syncService = useMemo(
    () => new SyncService({ storage, cursorApiBaseUrl }),
    [storage, cursorApiBaseUrl]
  );
  const i18n = I18N[language];

  const createCursorClient = (apiKey: string): CursorApiClient =>
    new CursorApiClient(apiKey, { baseUrl: cursorApiBaseUrl });

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const [savedConfig, savedSnapshot] = await Promise.all([storage.getConfig(), storage.getSnapshot()]);
      if (disposed) {
        return;
      }
      setConfig(savedConfig);
      setDraft(savedConfig);
      setSnapshot(savedSnapshot);
      setLoading(false);
      void syncService.syncAll({ source: "startup" }).catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : i18n.initialSyncFailed);
      });
    })();

    const unsubscribe = syncService.subscribe((next: SyncSnapshot) => {
      setSnapshot(next);
    });

    const spendInterval = window.setInterval(() => {
      void syncService.syncSpend("background");
    }, SPEND_SYNC_MINUTES * 60 * 1000);
    const dailyInterval = window.setInterval(() => {
      void syncService.syncDailyUsage("background");
    }, DAILY_USAGE_SYNC_MINUTES * 60 * 1000);

    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(spendInterval);
      window.clearInterval(dailyInterval);
      syncService.dispose();
    };
  }, [storage, syncService]);

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
    if (!keyValidation || (validatingKey && keyValidation.tone === "info")) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setKeyValidation(null);
    }, FEEDBACK_AUTO_HIDE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [keyValidation, validatingKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WINDOW_MODE_STORAGE_KEY, windowMode);
    } catch {
      // ignore storage write errors
    }
    void applyWindowSize(windowMode).catch(() => {
      // ignore window resize errors in browser-only preview mode
    });
  }, [windowMode]);

  const summary = useMemo(
    () => getUsageSummary(snapshot.spend, config.myEmail, config.teamBudgetUsd),
    [snapshot.spend, config.myEmail, config.teamBudgetUsd]
  );

  const myPercent = percent(summary.mySpendUsd, summary.myLimitUsd);
  const teamPercent = percent(summary.teamSpendUsd, summary.teamBudgetUsd);

  const topMembers = useMemo(() => {
    return (snapshot.spend?.teamMemberSpend ?? [])
      .slice()
      .sort((a, b) => {
        const left = resolveMemberSpendUsd(a) ?? -1;
        const right = resolveMemberSpendUsd(b) ?? -1;
        return right - left;
      })
      .map((member) => ({
        email: member.email,
        name: member.name ? formatKoreanDisplayName(member.name) : member.email,
        usd: resolveMemberSpendUsd(member)
      }));
  }, [snapshot.spend]);

  const usageEvents24h = useMemo(() => {
    const rows = snapshot.usageEvents?.data ?? [];
    if (rows.length === 0) {
      return null;
    }
    const windowStart = Date.now() - 24 * 60 * 60 * 1000;
    const recent = rows.filter((row) => row.timestamp >= windowStart);
    const target = recent.length > 0 ? recent : rows;
    const chargedUsd =
      target.reduce(
        (acc, row) => acc + (Number.isFinite(row.chargedCents) ? row.chargedCents : 0),
        0
      ) / 100;
    const inputTokens = target.reduce(
      (acc, row) => acc + (Number.isFinite(row.inputTokens) ? (row.inputTokens ?? 0) : 0),
      0
    );
    const outputTokens = target.reduce(
      (acc, row) => acc + (Number.isFinite(row.outputTokens) ? (row.outputTokens ?? 0) : 0),
      0
    );
    return {
      eventCount: target.length,
      chargedUsd,
      inputTokens,
      outputTokens
    };
  }, [snapshot.usageEvents]);
  const usageEventsError = snapshot.errors.usageEvents ?? null;

  const tabIndex = Math.max(0, TABS.findIndex((item) => item === tab));
  const isMiniMode = windowMode === "mini";
  const lastSyncedAtLabel = snapshot.lastSyncAt
    ? new Date(snapshot.lastSyncAt).toLocaleTimeString()
    : "-";
  const safeMyPercent = clamp(myPercent);
  const hasMyUsageData = summary.myLimitUsd !== null && summary.mySpendUsd !== null;
  const remainingMyUsd =
    summary.myLimitUsd === null || summary.mySpendUsd === null
      ? null
      : Math.max(summary.myLimitUsd - summary.mySpendUsd, 0);
  const remainingMyPercent = hasMyUsageData ? Math.max(100 - safeMyPercent, 0) : null;
  const remainingToneClass = getRemainingTone(remainingMyPercent);

  const onManualSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const next = await syncService.syncAll({ source: "manual", manual: true });
      setSnapshot(next);
      setFeedback(i18n.syncSuccess);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : i18n.syncFailed);
    } finally {
      setSyncing(false);
    }
  };

  const onToggleWindowMode = () => {
    setWindowMode((prev) => (prev === "max" ? "mini" : "max"));
  };

  const onHideWindow = async () => {
    try {
      await hideCurrentWindow();
    } catch {
      // ignore when running outside tauri host
    }
  };

  const onSaveConfig = async () => {
    setSaving(true);
    const nextDraft = applyMockDefaults(draft);
    if (JSON.stringify(nextDraft) !== JSON.stringify(draft)) {
      setDraft(nextDraft);
    }
    try {
      await storage.setConfig(nextDraft);
      setConfig(nextDraft);
      setFeedback(i18n.saveSuccess);
      void syncService.syncSpend("manual");
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
      const result = isMockApiKey(config.apiKey)
        ? createMockSetUserSpendLimitResponse(request)
        : await createCursorClient(config.apiKey).setUserSpendLimit(request);
      const baseMessage = result.message ?? i18n.limitApplySuccess;
      const normalizedRequestEmail = request.userEmail.trim();
      if (!config.myEmail.trim() && normalizedRequestEmail) {
        const nextConfig = {
          ...config,
          myEmail: normalizedRequestEmail
        };
        await storage.setConfig(nextConfig);
        setConfig(nextConfig);
        setDraft((prev) => ({
          ...prev,
          myEmail: normalizedRequestEmail
        }));
        void syncService.syncSpend("manual");
        setFeedback(`${baseMessage} (${i18n.myEmailAutoSet})`);
      } else {
        setFeedback(baseMessage);
      }
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

    if (isMockApiKey(apiKey)) {
      setKeyValidation({
        tone: "success",
        message: i18n.keyMockMode
      });
      return;
    }

    const traceId = createTraceId();
    const apiKeyFingerprint = fingerprintApiKey(apiKey);
    const startedAt = Date.now();
    const baseUrl = cursorApiBaseUrl ?? "https://api.cursor.com";

    setValidatingKey(true);
    setKeyValidation({
      tone: "info",
      message: i18n.keyChecking
    });
    appendAuthValidationLog({
      traceId,
      stage: "start",
      level: "info",
      endpoint: AUTH_VALIDATE_ENDPOINT,
      method: "POST",
      baseUrl,
      apiKeyFingerprint
    });

    try {
      await createCursorClient(apiKey).postSpend({ page: 1, pageSize: 1 });
      appendAuthValidationLog({
        traceId,
        stage: "success",
        level: "info",
        endpoint: AUTH_VALIDATE_ENDPOINT,
        method: "POST",
        baseUrl,
        durationMs: Date.now() - startedAt,
        httpStatus: 200,
        apiKeyFingerprint
      });
      setKeyValidation({
        tone: "success",
        message: i18n.keyValid
      });
    } catch (error) {
      const classified = classifyAuthValidationError(error);
      appendAuthValidationLog({
        traceId,
        stage: "failure",
        level: "error",
        endpoint: AUTH_VALIDATE_ENDPOINT,
        method: "POST",
        baseUrl,
        durationMs: Date.now() - startedAt,
        httpStatus: classified.status,
        retryable: classified.retryable,
        errorKind: classified.kind,
        errorMessage: classified.message,
        apiKeyFingerprint
      });

      if (error instanceof CursorApiError) {
        if (error.status === 401) {
          setKeyValidation({
            tone: "error",
            message: `${i18n.keyInvalid} (trace: ${traceId})`
          });
        } else if (error.status === 403) {
          setKeyValidation({
            tone: "warn",
            message: `${i18n.keyNoEnterprise} (trace: ${traceId})`
          });
        } else if (error.status === 429) {
          setKeyValidation({
            tone: "warn",
            message: `${i18n.keyRateLimited} (trace: ${traceId})`
          });
        } else {
          setKeyValidation({
            tone: "error",
            message: `${i18n.keyFailedWithStatus} (${error.status}): ${error.message} (trace: ${traceId})`
          });
        }
      } else {
        setKeyValidation({
          tone: "error",
          message: `${error instanceof Error ? error.message : i18n.keyFailed} (trace: ${traceId})`
        });
      }
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
      <div className="popover-root">
        <div className="popover-card">{i18n.loading}</div>
      </div>
    );
  }

  return (
    <div className={`popover-root ${isMiniMode ? "mini-mode" : ""}`}>
      <section className={`popover-card ${isMiniMode ? "mini-shell" : ""}`}>
        <div className="drag-strip">
          <span />
        </div>

        <header className="popover-header">
          <div className="popover-brand">
            <img src="/icons/cursor-48.png" alt="Cursor" />
            <div>
              <h1>Cursor Teams Usage</h1>
              <p>{`v${APP_VERSION} by TAEINN`}</p>
            </div>
          </div>
          <div className="header-actions">
            {!isMiniMode ? (
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
            ) : null}
            <button className={`mini-btn ${isMiniMode ? "icon-btn" : ""}`} onClick={onManualSync} disabled={syncing}>
              {syncing ? "..." : isMiniMode ? "↻" : i18n.refresh}
            </button>
            <div className="window-controls">
              <button
                className="window-btn close"
                onClick={onHideWindow}
                title={i18n.hideWindow}
                aria-label={i18n.hideWindow}
              >
                <span className="window-glyph glyph-close" aria-hidden="true" />
              </button>
              <button
                className={`window-btn mode ${isMiniMode ? "restore" : ""}`}
                onClick={onToggleWindowMode}
                title={isMiniMode ? i18n.switchToMax : i18n.switchToMini}
                aria-label={isMiniMode ? i18n.switchToMax : i18n.switchToMini}
              >
                <span
                  className={`window-glyph ${isMiniMode ? "glyph-plus" : "glyph-minus"}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </header>

        <p className={`popover-feedback ${isMiniMode ? "mini-feedback" : ""} ${feedback ? "" : "is-empty"}`}>
          {feedback ?? ""}
        </p>

        {isMiniMode ? (
          <>
            <section className="mini-mode-panel">
              <div className="mini-mode-head">
                <div>
                  <p className="mini-mode-title">{i18n.miniModeTitle}</p>
                  <p className="mini-mode-subtitle">{i18n.miniModeSubtitle}</p>
                </div>
                <span className={`mini-remaining-chip ${remainingToneClass}`}>
                  {remainingMyPercent === null ? "-" : `${remainingMyPercent.toFixed(0)}%`} {i18n.miniRemainingLabel}
                </span>
              </div>
              <div className="mini-mode-amount-wrap">
                <p className="mini-mode-amount">
                  {remainingMyUsd === null
                    ? i18n.miniNoData
                    : formatUsdWithApproxKrw(remainingMyUsd, snapshot.fxRate?.usdToKrw ?? null)}
                </p>
              </div>
              <div
                className="mini-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasMyUsageData ? safeMyPercent : 0}
              >
                <span className="mini-progress-used" style={{ width: `${safeMyPercent}%` }} />
              </div>
              <div className="mini-progress-meta">
                <span>
                  {i18n.miniUsedLabel}:{" "}
                  {summary.mySpendUsd === null
                    ? "-"
                    : formatUsdWithApproxKrw(summary.mySpendUsd, snapshot.fxRate?.usdToKrw ?? null)}
                </span>
              </div>
            </section>

            <footer className="popover-footer mini-footer">
              <span>{`${i18n.autoSync} (${lastSyncedAtLabel})`}</span>
            </footer>
          </>
        ) : (
          <>
            <nav className="popover-tabs">
              <span className="tab-indicator" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
              {TABS.map((tabKey) => (
                <button
                  key={tabKey}
                  className={`popover-tab ${tab === tabKey ? "active" : ""}`}
                  onClick={() => setTab(tabKey)}
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
                      onInfoClick={() =>
                        setActiveInfo({
                          label: i18n.myUsage,
                          content: i18n.myUsageInfo
                        })
                      }
                      subtitle={
                        summary.mySpendUsd === null
                          ? config.myEmail.trim()
                            ? i18n.myNoData
                            : i18n.myEmailNotConfigured
                          : summary.myLimitUsd === null
                            ? `${formatUsdWithApproxKrw(summary.mySpendUsd, snapshot.fxRate?.usdToKrw ?? null)} / ${i18n.myLimitNotConfigured}`
                            : `${formatUsdWithApproxKrw(summary.mySpendUsd, snapshot.fxRate?.usdToKrw ?? null)} / ${formatUsdWithApproxKrw(summary.myLimitUsd, snapshot.fxRate?.usdToKrw ?? null)}`
                      }
                    />
                    <RingGauge
                      label={i18n.teamUsage}
                      percent={teamPercent}
                      onInfoClick={() =>
                        setActiveInfo({
                          label: i18n.teamUsage,
                          content: i18n.teamUsageInfo
                        })
                      }
                      subtitle={
                        summary.teamSpendUsd === null || summary.teamBudgetUsd === null
                          ? i18n.teamNoData
                          : `${formatUsdWithApproxKrw(summary.teamSpendUsd, snapshot.fxRate?.usdToKrw ?? null)} / ${formatUsdWithApproxKrw(summary.teamBudgetUsd, snapshot.fxRate?.usdToKrw ?? null)}`
                      }
                    />
                  </div>
                  <div className="mini-metrics">
                    <div className="metric-tile">
                      <strong>{i18n.usageEvents24h}</strong>
                      <p>
                        {usageEvents24h
                          ? formatUsdWithApproxKrw(usageEvents24h.chargedUsd, snapshot.fxRate?.usdToKrw ?? null)
                          : usageEventsError
                            ? i18n.usageEventsApiFailed
                            : i18n.usageEventsNoData}
                      </p>
                      <small>
                        {i18n.usageEventsCount}: {usageEvents24h ? usageEvents24h.eventCount.toLocaleString() : "-"}
                      </small>
                      <InfoHint
                        label={i18n.usageEvents24h}
                        onOpen={() =>
                          setActiveInfo({
                            label: i18n.usageEvents24h,
                            content: i18n.usageEventsInfo
                          })
                        }
                      />
                    </div>
                    <div className="metric-tile">
                      <strong>{i18n.usageEventsTokens}</strong>
                      <p>
                        {usageEvents24h
                          ? `${usageEvents24h.inputTokens.toLocaleString()} / ${usageEvents24h.outputTokens.toLocaleString()}`
                          : usageEventsError
                            ? i18n.tokensApiFailed
                            : "-"}
                      </p>
                      <InfoHint
                        label={i18n.usageEventsTokens}
                        onOpen={() =>
                          setActiveInfo({
                            label: i18n.usageEventsTokens,
                            content: i18n.tokensInfo
                          })
                        }
                      />
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
                          <span>
                            {member.usd === null
                              ? "-"
                              : formatUsdWithApproxKrw(member.usd, snapshot.fxRate?.usdToKrw ?? null)}
                          </span>
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
                            type={showApiKey ? "text" : "password"}
                            value={draft.apiKey}
                            placeholder={i18n.apiKeyPlaceholder}
                            onChange={(event) => {
                              setDraft({ ...draft, apiKey: event.target.value });
                              setKeyValidation(null);
                            }}
                          />
                          <button
                            className="mini-btn key-visibility-btn"
                            onClick={() => setShowApiKey((prev) => !prev)}
                            aria-label={showApiKey ? i18n.hideApiKey : i18n.showApiKey}
                            title={showApiKey ? i18n.hideApiKey : i18n.showApiKey}
                          >
                            <VisibilityIcon masked={!showApiKey} />
                          </button>
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

            <footer className="popover-footer">
              <span>{`${i18n.autoSync} (${lastSyncedAtLabel})`}</span>
            </footer>
          </>
        )}
        {activeInfo ? (
          <div className="info-modal-backdrop" onClick={() => setActiveInfo(null)}>
            <div
              className="info-modal-card"
              role="dialog"
              aria-modal="true"
              aria-label={activeInfo.label}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="info-modal-head">
                <strong>{activeInfo.label}</strong>
                <button
                  type="button"
                  className="info-modal-close"
                  aria-label={i18n.infoClose}
                  onClick={() => setActiveInfo(null)}
                >
                  ×
                </button>
              </div>
              <p>{activeInfo.content}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
