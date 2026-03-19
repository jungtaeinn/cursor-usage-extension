export function centsToUsd(cents: number): number {
  return cents / 100;
}

export function usdToKrw(usd: number, usdToKrwRate: number): number {
  return usd * usdToKrwRate;
}

export function formatUsd(usd: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(usd);
}

export function formatKrw(krw: number, locale = "ko-KR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "KRW",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(krw);
}

export function formatUsdWithApproxKrw(
  usd: number,
  usdToKrwRate: number | null,
  locale = "ko-KR"
): string {
  const usdText = formatUsd(usd);
  if (!usdToKrwRate) {
    return usdText;
  }
  const krw = usdToKrw(usd, usdToKrwRate);
  return `${usdText} (약 ${formatKrw(krw, locale)})`;
}
