import { EMPTY_SNAPSHOT, MAX_DATE_RANGE_DAYS } from "../constants";
import { evaluateAlertTransitions, purgeOldCycleAlerts } from "../alerts/alertEngine";
import { deliverAlerts, type NotifierDeliveryResult } from "../alerts/notifiers";
import { CursorApiClient, CursorApiError } from "../api/cursorApi";
import { FxApiClient } from "../api/fxApi";
import {
  createMockFilteredUsageEventsResponse,
  createMockDailyUsageResponse,
  createMockSpendResponse,
  isMockApiKey
} from "../mock/cursorMock";
import { getUsageSummary } from "../selectors";
import { now, shouldRefreshByInterval } from "../utils/time";
import type {
  AppConfig,
  DailyUsageRequest,
  DailyUsageResponse,
  FilteredUsageEventsResponse,
  SpendRequest,
  SpendResponse,
  StorageAdapter,
  SyncOptions,
  SyncServiceContract,
  SyncSnapshot,
  SyncSource
} from "../types";

type FetchFn = typeof fetch;

interface SyncServiceDeps {
  storage: StorageAdapter;
  fetchImpl?: FetchFn;
}

type InFlightTask = {
  promise: Promise<SyncSnapshot>;
  controller: AbortController;
};

interface CursorSyncClient {
  postSpend(payload?: SpendRequest, signal?: AbortSignal): Promise<SpendResponse>;
  postDailyUsageData(
    payload: DailyUsageRequest,
    signal?: AbortSignal
  ): Promise<DailyUsageResponse>;
  postFilteredUsageEvents?(
    payload: { startDate: number; endDate: number; page?: number; pageSize?: number },
    signal?: AbortSignal
  ): Promise<FilteredUsageEventsResponse>;
}

export class SyncService implements SyncServiceContract {
  private readonly storage: StorageAdapter;
  private readonly fetchImpl: FetchFn;
  private readonly fxClient: FxApiClient;
  private readonly listeners = new Set<(snapshot: SyncSnapshot) => void>();
  private readonly inFlight = new Map<string, InFlightTask>();

  constructor(deps: SyncServiceDeps) {
    this.storage = deps.storage;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.fxClient = new FxApiClient({ fetchImpl: this.fetchImpl });
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    return (await this.storage.getSnapshot()) ?? EMPTY_SNAPSHOT;
  }

  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async syncSpend(source: SyncSource = "background"): Promise<SyncSnapshot> {
    return this.dedupe("syncSpend", async (controller) => {
      const config = await this.storage.getConfig();
      let snapshot = await this.getSnapshot();
      const client = this.createCursorClient(config);
      const spend = await client.postSpend({}, controller.signal);
      snapshot = this.applySpendSuccess(snapshot, spend, source);
      snapshot = await this.refreshFxIfNeeded(snapshot, config, controller.signal, false);
      snapshot = await this.handleAlerts(snapshot, config);
      await this.persistSnapshot(snapshot);
      return snapshot;
    });
  }

  async syncDailyUsage(source: SyncSource = "background"): Promise<SyncSnapshot> {
    return this.dedupe("syncDailyUsage", async (controller) => {
      const config = await this.storage.getConfig();
      let snapshot = await this.getSnapshot();
      const client = this.createCursorClient(config);
      const range = this.resolveDateRange(snapshot.spend);
      const dailyUsageRequest: DailyUsageRequest = {
        startDate: range.startDate,
        endDate: range.endDate,
        page: 1,
        pageSize: 1000
      };
      const usageEventsRequest = {
        startDate: range.startDate,
        endDate: range.endDate,
        page: 1,
        pageSize: 200
      };
      const usageEventsPromise =
        typeof client.postFilteredUsageEvents === "function"
          ? client.postFilteredUsageEvents(usageEventsRequest, controller.signal)
          : null;

      let dailyResult: PromiseSettledResult<DailyUsageResponse>;
      let usageEventsResult: PromiseSettledResult<FilteredUsageEventsResponse> | null = null;

      if (usageEventsPromise) {
        [dailyResult, usageEventsResult] = await Promise.allSettled([
          client.postDailyUsageData(dailyUsageRequest, controller.signal),
          usageEventsPromise
        ]);
      } else {
        [dailyResult] = await Promise.allSettled([
          client.postDailyUsageData(dailyUsageRequest, controller.signal)
        ]);
      }

      if (dailyResult.status === "fulfilled") {
        snapshot = this.applyDailyUsageSuccess(snapshot, dailyResult.value, source);
      } else {
        snapshot = this.applyEndpointError(snapshot, "dailyUsage", dailyResult.reason, source);
      }

      if (usageEventsResult && usageEventsResult.status === "fulfilled") {
        snapshot = this.applyUsageEventsSuccess(snapshot, usageEventsResult.value, source);
      } else if (usageEventsResult && usageEventsResult.status === "rejected") {
        snapshot = this.applyEndpointError(snapshot, "usageEvents", usageEventsResult.reason, source);
      } else {
        snapshot.stale.usageEvents = true;
      }

      await this.persistSnapshot(snapshot);
      return snapshot;
    });
  }

  async syncAll(options: Partial<SyncOptions> = {}): Promise<SyncSnapshot> {
    const source = options.source ?? (options.manual ? "manual" : "background");
    const includeUsageEvents = options.includeUsageEvents ?? true;

    return this.dedupe("syncAll", async (controller) => {
      const config = await this.storage.getConfig();
      const client = this.createCursorClient(config);
      let snapshot = await this.getSnapshot();

      const spendPromise = client.postSpend({}, controller.signal);
      const dailyPromise = client.postDailyUsageData(
        {
          ...this.resolveDateRange(snapshot.spend),
          page: 1,
          pageSize: 1000
        },
        controller.signal
      );

      const usageEventsPromise =
        includeUsageEvents && typeof client.postFilteredUsageEvents === "function"
          ? client.postFilteredUsageEvents(
              {
                ...this.resolveDateRange(snapshot.spend),
                page: 1,
                pageSize: 200
              },
              controller.signal
            )
          : null;

      let spendResult: PromiseSettledResult<SpendResponse>;
      let dailyResult: PromiseSettledResult<DailyUsageResponse>;
      let usageEventsResult: PromiseSettledResult<FilteredUsageEventsResponse> | null = null;

      if (usageEventsPromise) {
        [spendResult, dailyResult, usageEventsResult] = await Promise.allSettled([
          spendPromise,
          dailyPromise,
          usageEventsPromise
        ]);
      } else {
        [spendResult, dailyResult] = await Promise.allSettled([spendPromise, dailyPromise]);
      }

      if (spendResult.status === "fulfilled") {
        snapshot = this.applySpendSuccess(snapshot, spendResult.value, source);
      } else {
        snapshot = this.applyEndpointError(snapshot, "spend", spendResult.reason, source);
      }

      if (dailyResult.status === "fulfilled") {
        snapshot = this.applyDailyUsageSuccess(snapshot, dailyResult.value, source);
      } else {
        snapshot = this.applyEndpointError(snapshot, "dailyUsage", dailyResult.reason, source);
      }

      if (usageEventsResult && usageEventsResult.status === "fulfilled") {
        snapshot = this.applyUsageEventsSuccess(snapshot, usageEventsResult.value, source);
      } else if (usageEventsResult && usageEventsResult.status === "rejected") {
        snapshot = this.applyEndpointError(snapshot, "usageEvents", usageEventsResult.reason, source);
      } else if (!includeUsageEvents) {
        snapshot.stale.usageEvents = true;
      }

      snapshot = await this.refreshFxIfNeeded(snapshot, config, controller.signal, options.manual ?? false);
      snapshot = await this.handleAlerts(snapshot, config);

      await this.persistSnapshot(snapshot);
      return snapshot;
    });
  }

  dispose(): void {
    for (const task of this.inFlight.values()) {
      task.controller.abort();
    }
    this.inFlight.clear();
    this.listeners.clear();
  }

  private createCursorClient(config: AppConfig): CursorSyncClient {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error("Cursor API Key가 설정되지 않았습니다.");
    }
    if (isMockApiKey(apiKey)) {
      return {
        postSpend: async () => createMockSpendResponse(config.myEmail, now()),
        postDailyUsageData: async () => createMockDailyUsageResponse(now()),
        postFilteredUsageEvents: async () => createMockFilteredUsageEventsResponse(now())
      };
    }

    return new CursorApiClient(apiKey, {
      fetchImpl: this.fetchImpl
    });
  }

  private resolveDateRange(spend: SpendResponse | null): { startDate: number; endDate: number } {
    const endDate = now();
    const cycleStart = spend?.subscriptionCycleStart ?? endDate;
    const maxRangeMs = (MAX_DATE_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000;
    const startDate = Math.max(cycleStart, endDate - maxRangeMs);
    return { startDate, endDate };
  }

  private applySpendSuccess(
    previous: SyncSnapshot,
    spend: SpendResponse,
    source: SyncSource
  ): SyncSnapshot {
    return {
      ...previous,
      spend,
      lastSyncAt: now(),
      source,
      stale: {
        ...previous.stale,
        spend: false
      },
      errors: {
        ...previous.errors,
        spend: undefined
      },
      enterpriseRestricted: false
    };
  }

  private applyDailyUsageSuccess(
    previous: SyncSnapshot,
    dailyUsage: DailyUsageResponse,
    source: SyncSource
  ): SyncSnapshot {
    return {
      ...previous,
      dailyUsage,
      lastSyncAt: now(),
      source,
      stale: {
        ...previous.stale,
        dailyUsage: false
      },
      errors: {
        ...previous.errors,
        dailyUsage: undefined
      }
    };
  }

  private applyUsageEventsSuccess(
    previous: SyncSnapshot,
    usageEvents: FilteredUsageEventsResponse,
    source: SyncSource
  ): SyncSnapshot {
    return {
      ...previous,
      usageEvents,
      lastSyncAt: now(),
      source,
      stale: {
        ...previous.stale,
        usageEvents: false
      },
      errors: {
        ...previous.errors,
        usageEvents: undefined
      }
    };
  }

  private applyEndpointError(
    previous: SyncSnapshot,
    endpoint: "spend" | "dailyUsage" | "usageEvents",
    reason: unknown,
    source: SyncSource
  ): SyncSnapshot {
    const message =
      reason instanceof CursorApiError
        ? `(${reason.status}) ${reason.message}`
        : reason instanceof Error
        ? reason.message
        : String(reason);

    const enterpriseRestricted =
      reason instanceof CursorApiError && reason.status === 403 ? true : previous.enterpriseRestricted;

    return {
      ...previous,
      source,
      lastSyncAt: now(),
      stale: {
        ...previous.stale,
        [endpoint]: true
      },
      errors: {
        ...previous.errors,
        [endpoint]: message
      },
      enterpriseRestricted
    };
  }

  private async refreshFxIfNeeded(
    snapshot: SyncSnapshot,
    config: AppConfig,
    signal: AbortSignal,
    force: boolean
  ): Promise<SyncSnapshot> {
    const lastFetchedAt = snapshot.fxRate?.fetchedAt ?? null;
    if (!force && !shouldRefreshByInterval(lastFetchedAt, config.fx.refreshMinutes)) {
      return snapshot;
    }

    try {
      const fxRate = await this.fxClient.fetchUsdToKrw(signal);
      return {
        ...snapshot,
        fxRate
      };
    } catch {
      return snapshot;
    }
  }

  private async handleAlerts(snapshot: SyncSnapshot, config: AppConfig): Promise<SyncSnapshot> {
    const summary = getUsageSummary(snapshot.spend, config.myEmail, config.teamBudgetUsd);
    const previous = await this.storage.getAlertState();
    const pruned = purgeOldCycleAlerts(previous, summary.cycleStart);
    const { nextState, payloads } = evaluateAlertTransitions(
      summary,
      {
        personalPercent: config.thresholds.personalPercent,
        teamPercent: config.thresholds.teamPercent
      },
      pruned
    );

    if (payloads.length > 0) {
      const deliveryResults = await deliverAlerts(config.alertChannels, payloads, {
        fetchImpl: this.fetchImpl
      });
      this.attachAlertDeliveryErrors(snapshot, deliveryResults);
    }

    await this.storage.setAlertState(nextState);
    return snapshot;
  }

  private attachAlertDeliveryErrors(
    snapshot: SyncSnapshot,
    deliveryResults: NotifierDeliveryResult[]
  ): void {
    const failed = deliveryResults.filter((result) => !result.ok);
    if (failed.length === 0) {
      return;
    }
    snapshot.errors = {
      ...snapshot.errors,
      spend: `${
        snapshot.errors.spend ? `${snapshot.errors.spend} | ` : ""
      }알림 전송 실패 ${failed.length}건`
    };
  }

  private async persistSnapshot(snapshot: SyncSnapshot): Promise<void> {
    await this.storage.setSnapshot(snapshot);
    this.emit(snapshot);
  }

  private emit(snapshot: SyncSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private async dedupe(
    key: string,
    task: (controller: AbortController) => Promise<SyncSnapshot>
  ): Promise<SyncSnapshot> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing.promise;
    }

    const controller = new AbortController();
    const promise = task(controller).catch(async (error) => {
      const source: SyncSource = key === "syncAll" ? "manual" : "background";
      const endpoint = key === "syncDailyUsage" ? "dailyUsage" : "spend";
      const snapshot = await this.getSnapshot();
      const errored = this.applyEndpointError(snapshot, endpoint, error, source);
      await this.persistSnapshot(errored);
      throw error;
    }).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, { controller, promise });
    return promise;
  }
}
