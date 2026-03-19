import { centsToUsd } from "./utils/currency";
import type { SpendMember, SpendResponse, UsageSummary } from "./types";

export function resolveMemberLimitUsd(member: SpendMember): number | null {
  if (member.hardLimitOverrideDollars > 0) {
    return member.hardLimitOverrideDollars;
  }
  return member.monthlyLimitDollars;
}

export function findMySpendMember(
  spend: SpendResponse | null,
  myEmail: string
): SpendMember | null {
  if (!spend || !myEmail.trim()) {
    return null;
  }
  const normalized = myEmail.trim().toLowerCase();
  return (
    spend.teamMemberSpend.find((member) => member.email.toLowerCase() === normalized) ??
    null
  );
}

export function getTeamSpendUsd(spend: SpendResponse | null): number | null {
  if (!spend) {
    return null;
  }
  const totalCents = spend.teamMemberSpend.reduce(
    (acc, member) => acc + member.overallSpendCents,
    0
  );
  return centsToUsd(totalCents);
}

export function getUsageSummary(
  spend: SpendResponse | null,
  myEmail: string,
  teamBudgetUsd: number | null
): UsageSummary {
  const member = findMySpendMember(spend, myEmail);
  const mySpendUsd = member ? centsToUsd(member.overallSpendCents) : null;
  const myLimitUsd = member ? resolveMemberLimitUsd(member) : null;
  const teamSpendUsd = getTeamSpendUsd(spend);

  return {
    myEmail,
    mySpendUsd,
    myLimitUsd,
    teamSpendUsd,
    teamBudgetUsd,
    cycleStart: spend?.subscriptionCycleStart ?? null
  };
}

export function percent(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null || limit <= 0) {
    return null;
  }
  return (used / limit) * 100;
}
