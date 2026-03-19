import type { AlertState, AppConfig, SyncSnapshot } from "./types";

export const API_BASE_URL = "https://api.cursor.com";
export const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";

export const DEFAULT_CONFIG: AppConfig = {
  apiKey: "",
  myEmail: "",
  teamBudgetUsd: null,
  thresholds: {
    personalPercent: 80,
    teamPercent: 80
  },
  alertChannels: {
    resendApiKey: "",
    resendFrom: "",
    emailRecipients: [],
    teamsWebhooks: []
  },
  fx: {
    provider: "open-er-api",
    refreshMinutes: 60
  },
  theme: "system",
  locale: "ko-KR"
};

export const EMPTY_SNAPSHOT: SyncSnapshot = {
  spend: null,
  dailyUsage: null,
  usageEvents: null,
  lastSyncAt: null,
  source: null,
  stale: {
    spend: true,
    dailyUsage: true,
    usageEvents: true
  },
  errors: {},
  enterpriseRestricted: false,
  fxRate: null
};

export const EMPTY_ALERT_STATE: AlertState = {
  sent: {}
};

export const MAX_DATE_RANGE_DAYS = 30;
