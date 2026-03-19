export type ThemeMode = "light" | "dark" | "system";

export interface AlertThresholds {
  personalPercent: number;
  teamPercent: number;
}

export interface AlertChannels {
  resendApiKey: string;
  resendFrom: string;
  emailRecipients: string[];
  teamsWebhooks: string[];
}

export interface FxSettings {
  provider: "open-er-api";
  refreshMinutes: number;
}

export interface AppConfig {
  apiKey: string;
  myEmail: string;
  teamBudgetUsd: number | null;
  thresholds: AlertThresholds;
  alertChannels: AlertChannels;
  fx: FxSettings;
  theme: ThemeMode;
  locale: "ko-KR";
}

export type SyncSource = "startup" | "background" | "manual";

export interface SpendMember {
  userId: number;
  name?: string;
  email: string;
  role?: string;
  spendCents: number;
  overallSpendCents: number;
  fastPremiumRequests: number;
  hardLimitOverrideDollars: number;
  monthlyLimitDollars: number | null;
}

export interface SpendResponse {
  teamMemberSpend: SpendMember[];
  subscriptionCycleStart: number;
  totalMembers: number;
  totalPages: number;
}

export interface DailyUsagePoint {
  userId: number;
  day: string;
  date: number;
  isActive: boolean;
  email: string;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  totalApplies: number;
  totalAccepts: number;
  totalRejects: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  composerRequests: number;
  chatRequests: number;
  agentRequests: number;
  cmdkUsages: number;
  subscriptionIncludedReqs: number;
  apiKeyReqs: number;
  usageBasedReqs: number;
  bugbotUsages: number;
  mostUsedModel: string | null;
  applyMostUsedExtension: string | null;
  tabMostUsedExtension: string | null;
  clientVersion: string | null;
}

export interface DailyUsageResponse {
  data: DailyUsagePoint[];
  period: {
    startDate: number;
    endDate: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalUsers: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UsageEvent {
  timestamp: number;
  email: string;
  model?: string;
  chargedCents: number;
  totalCents: number;
  requestsCosts?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface FilteredUsageEventsResponse {
  data: UsageEvent[];
  period: {
    startDate: number;
    endDate: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface FxRateSnapshot {
  usdToKrw: number;
  fetchedAt: number;
  source: "open-er-api";
}

export interface SyncStaleFlags {
  spend: boolean;
  dailyUsage: boolean;
  usageEvents: boolean;
}

export interface SyncErrors {
  spend?: string;
  dailyUsage?: string;
  usageEvents?: string;
}

export interface SyncSnapshot {
  spend: SpendResponse | null;
  dailyUsage: DailyUsageResponse | null;
  usageEvents: FilteredUsageEventsResponse | null;
  lastSyncAt: number | null;
  source: SyncSource | null;
  stale: SyncStaleFlags;
  errors: SyncErrors;
  enterpriseRestricted: boolean;
  fxRate: FxRateSnapshot | null;
}

export interface AlertPayload {
  title: string;
  message: string;
  alertType: "personal" | "team";
  thresholdPercent: number;
  currentPercent: number;
  cycleStart: number;
  triggeredAt: number;
}

export interface AlertRecord {
  sentAt: number;
  cycleStart: number;
  threshold: number;
  alertType: "personal" | "team";
}

export interface AlertState {
  sent: Record<string, AlertRecord>;
}

export interface ThresholdInput {
  personalPercent: number | null;
  teamPercent: number | null;
}

export interface UsageSummary {
  myEmail: string;
  mySpendUsd: number | null;
  myLimitUsd: number | null;
  teamSpendUsd: number | null;
  teamBudgetUsd: number | null;
  cycleStart: number | null;
}

export interface SpendRequest {
  searchTerm?: string;
  sortBy?: "amount" | "date" | "user";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface DailyUsageRequest {
  startDate: number;
  endDate: number;
  page?: number;
  pageSize?: number;
}

export interface FilteredUsageEventsRequest {
  startDate: number;
  endDate: number;
  email?: string;
  page?: number;
  pageSize?: number;
}

export interface SetUserSpendLimitRequest {
  userEmail: string;
  spendLimitDollars: number | null;
}

export interface SetUserSpendLimitResponse {
  outcome: string;
  message: string;
}

export interface SyncOptions {
  source: SyncSource;
  manual?: boolean;
  includeUsageEvents?: boolean;
}

export interface SyncServiceContract {
  syncSpend(source?: SyncSource): Promise<SyncSnapshot>;
  syncDailyUsage(source?: SyncSource): Promise<SyncSnapshot>;
  syncAll(options?: Partial<SyncOptions>): Promise<SyncSnapshot>;
  getSnapshot(): Promise<SyncSnapshot>;
  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void;
}

export interface StorageAdapter {
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  getSnapshot(): Promise<SyncSnapshot | null>;
  setSnapshot(snapshot: SyncSnapshot): Promise<void>;
  getAlertState(): Promise<AlertState>;
  setAlertState(state: AlertState): Promise<void>;
}
