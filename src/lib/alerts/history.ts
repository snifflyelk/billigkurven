import { readFile } from "node:fs/promises";
import path from "node:path";

export type AlertDigestLog = {
  at: string;
  to: string;
  channel: "email" | "log-fallback" | "unknown";
  triggeredItems: number;
  buyNowCount: number;
  targetReachedCount: number;
  subject: string;
};

function getAlertLogPath() {
  return path.join(process.cwd(), "logs", "alert-events.log");
}

export async function readAlertDigestHistory(limit = 8): Promise<AlertDigestLog[]> {
  try {
    const raw = await readFile(getAlertLogPath(), "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const logs: AlertDigestLog[] = [];

    for (const line of lines.reverse()) {
      if (logs.length >= limit) break;
      try {
        const item = JSON.parse(line) as {
          at?: string;
          to?: string;
          subject?: string;
          channel?: string;
          kind?: string;
          metrics?: {
            triggeredItems?: number;
            buyNowCount?: number;
            targetReachedCount?: number;
          };
        };

        const subject = item.subject ?? "";
        const isDigest = item.kind === "basket-digest" || subject.toLowerCase().includes("ukesignal");
        if (!isDigest) continue;

        logs.push({
          at: item.at ?? new Date().toISOString(),
          to: item.to ?? "-",
          subject,
          channel:
            item.channel === "email" || item.channel === "log-fallback"
              ? item.channel
              : "unknown",
          triggeredItems: Number(item.metrics?.triggeredItems ?? 0),
          buyNowCount: Number(item.metrics?.buyNowCount ?? 0),
          targetReachedCount: Number(item.metrics?.targetReachedCount ?? 0),
        });
      } catch {
        continue;
      }
    }

    return logs;
  } catch {
    return [];
  }
}
