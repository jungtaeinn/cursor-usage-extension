import { API_BASE_URL } from "../constants";
import type {
  DailyUsageRequest,
  DailyUsageResponse,
  FilteredUsageEventsRequest,
  FilteredUsageEventsResponse,
  SetUserSpendLimitRequest,
  SetUserSpendLimitResponse,
  SpendRequest,
  SpendResponse
} from "../types";

export class CursorApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "CursorApiError";
    this.status = status;
    this.payload = payload;
  }
}

type SleepFn = (ms: number) => Promise<void>;

export interface CursorApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  max429Retries?: number;
  sleepImpl?: SleepFn;
}

export class CursorApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly max429Retries: number;
  private readonly sleepImpl: SleepFn;

  constructor(apiKey: string, options: CursorApiClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? API_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.max429Retries = options.max429Retries ?? 4;
    this.sleepImpl =
      options.sleepImpl ??
      (async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      });
  }

  async postSpend(payload: SpendRequest = {}, signal?: AbortSignal): Promise<SpendResponse> {
    return this.requestJson<SpendResponse>("/teams/spend", "POST", payload, signal);
  }

  async postDailyUsageData(
    payload: DailyUsageRequest,
    signal?: AbortSignal
  ): Promise<DailyUsageResponse> {
    return this.requestJson<DailyUsageResponse>(
      "/teams/daily-usage-data",
      "POST",
      payload,
      signal
    );
  }

  async postFilteredUsageEvents(
    payload: FilteredUsageEventsRequest,
    signal?: AbortSignal
  ): Promise<FilteredUsageEventsResponse> {
    return this.requestJson<FilteredUsageEventsResponse>(
      "/teams/filtered-usage-events",
      "POST",
      payload,
      signal
    );
  }

  async setUserSpendLimit(
    payload: SetUserSpendLimitRequest,
    signal?: AbortSignal
  ): Promise<SetUserSpendLimitResponse> {
    return this.requestJson<SetUserSpendLimitResponse>(
      "/teams/user-spend-limit",
      "POST",
      payload,
      signal
    );
  }

  private buildHeaders(): HeadersInit {
    const encoded = Buffer.from(`${this.apiKey}:`).toString("base64");
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`
    };
  }

  private async requestJson<T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal
      });

      if (response.status !== 429 || attempt >= this.max429Retries) {
        return this.handleResponse<T>(response);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const waitMs = 1000 * 2 ** attempt;
      attempt += 1;
      await this.sleepImpl(waitMs);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json") ?? false;
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Cursor API request failed with status ${response.status}`;
      throw new CursorApiError(message, response.status, payload);
    }

    return payload as T;
  }
}
