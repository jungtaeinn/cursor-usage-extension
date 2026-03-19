import { percent } from "../selectors";
import { now } from "../utils/time";
import type {
  AlertPayload,
  AlertState,
  ThresholdInput,
  UsageSummary
} from "../types";

function toAlertKey(
  cycleStart: number,
  alertType: "personal" | "team",
  threshold: number
): string {
  return `${cycleStart}:${alertType}:${threshold}`;
}

function shouldTrigger(currentPercent: number | null, threshold: number | null): boolean {
  if (currentPercent === null || threshold === null) {
    return false;
  }
  return currentPercent >= threshold;
}

export function evaluateAlertTransitions(
  summary: UsageSummary,
  thresholds: ThresholdInput,
  previousState: AlertState
): { nextState: AlertState; payloads: AlertPayload[] } {
  const nextState: AlertState = {
    sent: { ...previousState.sent }
  };
  const payloads: AlertPayload[] = [];
  const cycleStart = summary.cycleStart;

  if (!cycleStart) {
    return { nextState, payloads };
  }

  const myPercent = percent(summary.mySpendUsd, summary.myLimitUsd);
  const teamPercent = percent(summary.teamSpendUsd, summary.teamBudgetUsd);

  const checks: Array<{
    type: "personal" | "team";
    value: number | null;
    threshold: number | null;
    title: string;
    message: string;
  }> = [
    {
      type: "personal",
      value: myPercent,
      threshold: thresholds.personalPercent,
      title: "개인 사용량 경고",
      message: `${summary.myEmail}님의 개인 사용률이 임계치를 초과했습니다.`
    },
    {
      type: "team",
      value: teamPercent,
      threshold: thresholds.teamPercent,
      title: "팀 사용량 경고",
      message: "팀 전체 사용률이 임계치를 초과했습니다."
    }
  ];

  for (const check of checks) {
    if (!shouldTrigger(check.value, check.threshold)) {
      continue;
    }

    const key = toAlertKey(cycleStart, check.type, check.threshold as number);
    if (nextState.sent[key]) {
      continue;
    }

    const triggeredAt = now();
    nextState.sent[key] = {
      sentAt: triggeredAt,
      cycleStart,
      threshold: check.threshold as number,
      alertType: check.type
    };

    payloads.push({
      title: check.title,
      message: check.message,
      alertType: check.type,
      thresholdPercent: check.threshold as number,
      currentPercent: check.value as number,
      cycleStart,
      triggeredAt
    });
  }

  return { nextState, payloads };
}

export function purgeOldCycleAlerts(state: AlertState, currentCycleStart: number | null): AlertState {
  if (!currentCycleStart) {
    return state;
  }

  const next: AlertState = { sent: {} };
  for (const [key, value] of Object.entries(state.sent)) {
    if (value.cycleStart === currentCycleStart) {
      next.sent[key] = value;
    }
  }
  return next;
}
