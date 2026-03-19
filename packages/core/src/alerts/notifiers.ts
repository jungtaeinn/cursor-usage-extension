import type { AlertChannels, AlertPayload } from "../types";

export interface NotifierDeliveryResult {
  channel: "teams" | "email";
  target: string;
  ok: boolean;
  error?: string;
}

export interface NotifierContext {
  fetchImpl?: typeof fetch;
}

function normalizeList(items: string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function sendTeamsAlerts(
  webhooks: string[],
  payload: AlertPayload,
  ctx: NotifierContext = {}
): Promise<NotifierDeliveryResult[]> {
  const fetchImpl = ctx.fetchImpl ?? fetch;
  const targets = normalizeList(webhooks);

  const results: NotifierDeliveryResult[] = [];
  for (const webhook of targets) {
    try {
      const response = await fetchImpl(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          text: `${payload.message}\n현재 사용률: ${payload.currentPercent.toFixed(2)}% (임계치 ${payload.thresholdPercent}%)`
        })
      });
      if (!response.ok) {
        results.push({
          channel: "teams",
          target: webhook,
          ok: false,
          error: `HTTP ${response.status}`
        });
        continue;
      }
      results.push({
        channel: "teams",
        target: webhook,
        ok: true
      });
    } catch (error) {
      results.push({
        channel: "teams",
        target: webhook,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return results;
}

export async function sendResendAlerts(
  channels: AlertChannels,
  payload: AlertPayload,
  ctx: NotifierContext = {}
): Promise<NotifierDeliveryResult[]> {
  const recipients = normalizeList(channels.emailRecipients);
  if (!channels.resendApiKey || !channels.resendFrom || recipients.length === 0) {
    return [];
  }

  const fetchImpl = ctx.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channels.resendApiKey}`
      },
      body: JSON.stringify({
        from: channels.resendFrom,
        to: recipients,
        subject: `[Cursor Usage Extension] ${payload.title}`,
        html: `<p>${payload.message}</p><p>현재 사용률: <strong>${payload.currentPercent.toFixed(
          2
        )}%</strong> (임계치 ${payload.thresholdPercent}%)</p>`
      })
    });

    if (!response.ok) {
      return recipients.map((target) => ({
        channel: "email",
        target,
        ok: false,
        error: `HTTP ${response.status}`
      }));
    }
    return recipients.map((target) => ({
      channel: "email",
      target,
      ok: true
    }));
  } catch (error) {
    return recipients.map((target) => ({
      channel: "email",
      target,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }));
  }
}

export async function deliverAlerts(
  channels: AlertChannels,
  payloads: AlertPayload[],
  ctx: NotifierContext = {}
): Promise<NotifierDeliveryResult[]> {
  const results: NotifierDeliveryResult[] = [];
  for (const payload of payloads) {
    const teamsResults = await sendTeamsAlerts(channels.teamsWebhooks, payload, ctx);
    const resendResults = await sendResendAlerts(channels, payload, ctx);
    results.push(...teamsResults, ...resendResults);
  }
  return results;
}
