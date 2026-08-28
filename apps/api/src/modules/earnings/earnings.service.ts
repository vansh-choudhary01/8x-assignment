import { LedgerEntry } from "./ledgerEntry.model.ts";

export async function earningsFor(creatorUserId: string) {
  const entries = await LedgerEntry.find({ creatorUserId }).sort({ createdAt: -1 });
  const byCollab = new Map<string, { pending: number; earned: number; voided: number }>();
  for (const entry of entries) {
    const key = String(entry.collaborationId);
    if (!byCollab.has(key)) byCollab.set(key, { pending: 0, earned: 0, voided: 0 });
    const row = byCollab.get(key)!;
    if (entry.type === "PENDING") row.pending += entry.amount;
    if (entry.type === "EARNED") row.earned += entry.amount;
    if (entry.type === "VOIDED") row.voided += entry.amount;
  }
  let pending = 0;
  let earned = 0;
  let voided = 0;
  for (const row of byCollab.values()) {
    if (row.voided > 0) {
      voided += row.voided;
      continue;
    }
    if (row.earned > 0) {
      earned += row.earned;
      continue;
    }
    pending += row.pending;
  }
  return {
    pending,
    earned,
    voided,
    currency: entries[0]?.currency ?? "USD",
    entries: entries.map((entry) => ({
      id: String(entry._id),
      collaborationId: String(entry.collaborationId),
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      note: entry.note ?? "",
      createdAt: entry.createdAt,
    })),
  };
}
