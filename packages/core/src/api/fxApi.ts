import { OPEN_ER_API_URL } from "../constants";
import type { FxRateSnapshot } from "../types";

export interface FxClientOptions {
  fetchImpl?: typeof fetch;
}

interface FxResponse {
  result: string;
  rates: Record<string, number>;
  time_last_update_unix: number;
}

export class FxApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(options: FxClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchUsdToKrw(signal?: AbortSignal): Promise<FxRateSnapshot> {
    const response = await this.fetchImpl(OPEN_ER_API_URL, { signal });
    if (!response.ok) {
      throw new Error(`환율 API 요청 실패: ${response.status}`);
    }
    const payload = (await response.json()) as FxResponse;
    const rate = payload.rates.KRW;
    if (!rate) {
      throw new Error("환율 API 응답에서 KRW 데이터를 찾을 수 없습니다.");
    }
    return {
      usdToKrw: rate,
      fetchedAt: payload.time_last_update_unix * 1000,
      source: "open-er-api"
    };
  }
}
