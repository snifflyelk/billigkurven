import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LocalEventLogRow = {
  at: string;
  eventName: string;
  eventProps?: Record<string, string | number | boolean | null>;
  pathname?: string | null;
  source?: string;
  userAgent?: string | null;
};

function getLogPath() {
  return path.join(process.cwd(), "logs", "analytics-events.log");
}

export async function appendLocalEvent(row: LocalEventLogRow) {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    await mkdir(logsDir, { recursive: true });
    await appendFile(getLogPath(), `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    // Ignore local logging failures in restricted runtimes (e.g. serverless file systems).
  }
}

export async function readLocalEvents(limit = 5000): Promise<LocalEventLogRow[]> {
  try {
    const raw = await readFile(getLogPath(), "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const parsed: LocalEventLogRow[] = [];

    for (const line of lines.slice(-limit)) {
      try {
        const item = JSON.parse(line) as LocalEventLogRow;
        if (!item || typeof item !== "object") continue;
        if (!item.eventName || !item.at) continue;
        parsed.push(item);
      } catch {
        continue;
      }
    }

    return parsed;
  } catch {
    return [];
  }
}
