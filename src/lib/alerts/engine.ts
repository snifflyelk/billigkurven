import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { buildTimingSignal } from "@/lib/alerts/signal";

type TimingSignal = "kjop-na" | "vent" | "noytral" | "ukjent";

type ProductTiming = {
  latestPrice: number | null;
  changePct: number | null;
  dropFromLast7Pct: number | null;
  confidencePct: number | null;
  signal: TimingSignal;
};

export type AlertEvaluation = {
  alertId: string;
  productId: string;
  productName: string;
  triggered: boolean;
  reasons: string[];
  latestPrice: number | null;
  changePct: number | null;
  dropFromLast7Pct: number | null;
  confidencePct: number | null;
  signal: TimingSignal;
};

async function buildProductTiming(productId: string): Promise<ProductTiming> {
  const rows = await prisma.price.findMany({
    where: { productId, isQuarantined: false },
    orderBy: { date: "desc" },
    take: 300,
    select: { price: true, date: true },
  });

  const latestPrice = rows[0] ? Number(rows[0].price) : null;
  const timing = buildTimingSignal(rows.map((row) => ({ price: Number(row.price), date: row.date })));
  const signal: TimingSignal = timing.recommendation;
  return {
    latestPrice,
    changePct: timing.changePct,
    dropFromLast7Pct: timing.dropFromLast7Pct,
    confidencePct: timing.confidencePct,
    signal,
  };
}

async function writeLogLine(line: string) {
  const logsDir = path.join(process.cwd(), "logs");
  await mkdir(logsDir, { recursive: true });
  await appendFile(path.join(logsDir, "alert-events.log"), `${line}\n`, "utf8");
}

async function sendAlertMessage(args: {
  to: string;
  subject: string;
  body: string;
  channel?: "email" | "push";
  kind?: string;
  metrics?: {
    triggeredItems?: number;
    buyNowCount?: number;
    targetReachedCount?: number;
  };
}) {
  const host = process.env.ALERT_SMTP_HOST;
  const port = Number(process.env.ALERT_SMTP_PORT ?? "587");
  const user = process.env.ALERT_SMTP_USER;
  const pass = process.env.ALERT_SMTP_PASS;
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@billigkurven.local";

  if (args.channel === "push") {
    await writeLogLine(
      JSON.stringify({
        at: new Date().toISOString(),
        to: args.to,
        subject: args.subject,
        body: args.body,
        channel: "push-log-fallback",
        kind: args.kind,
        metrics: args.metrics,
      }),
    );
    return "push-log-fallback" as const;
  }

  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.body,
    });

    await writeLogLine(
      JSON.stringify({
        at: new Date().toISOString(),
        to: args.to,
        subject: args.subject,
        channel: "email",
        kind: args.kind,
        metrics: args.metrics,
      }),
    );

    return "email" as const;
  }

  await writeLogLine(
    JSON.stringify({
      at: new Date().toISOString(),
      to: args.to,
      subject: args.subject,
      body: args.body,
      channel: "log-fallback",
      kind: args.kind,
      metrics: args.metrics,
    }),
  );
  return "log" as const;
}

export async function evaluateAndDispatchAlerts() {
  const activeAlerts = await prisma.priceAlert.findMany({
    where: { isActive: true },
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const cooldownMs = Number(process.env.ALERT_COOLDOWN_HOURS ?? "18") * 60 * 60 * 1000;
  const evaluations: AlertEvaluation[] = [];
  const triggeredByUser = new Map<string, Array<{
    alertId: string;
    productName: string;
    reasons: string[];
    latestPrice: number | null;
    changePct: number | null;
    dropFromLast7Pct: number | null;
    confidencePct: number | null;
    signal: TimingSignal;
  }>>();
  let sentCount = 0;

  for (const alert of activeAlerts) {
    const timing = await buildProductTiming(alert.productId);
    const reasons: string[] = [];

    if (alert.targetPrice !== null && timing.latestPrice !== null && timing.latestPrice <= Number(alert.targetPrice)) {
      reasons.push("target-price");
    }

    if (
      alert.targetDropPct !== null &&
      timing.dropFromLast7Pct !== null &&
      timing.dropFromLast7Pct >= alert.targetDropPct
    ) {
      reasons.push("target-drop-pct");
    }

    if (timing.dropFromLast7Pct !== null && timing.dropFromLast7Pct >= 10) {
      reasons.push("price-drop-opportunity");
    }

    if (alert.notifyOnBuyNow && timing.signal === "kjop-na") {
      reasons.push("buy-now-signal");
    }

    const blockedByCooldown =
      alert.lastTriggeredAt !== null && Date.now() - alert.lastTriggeredAt.getTime() < cooldownMs;
    const shouldSend = reasons.length > 0 && !blockedByCooldown;

    evaluations.push({
      alertId: alert.id,
      productId: alert.product.id,
      productName: alert.product.name,
      triggered: shouldSend,
      reasons,
      latestPrice: timing.latestPrice,
      changePct: timing.changePct,
      dropFromLast7Pct: timing.dropFromLast7Pct,
      confidencePct: timing.confidencePct,
      signal: timing.signal,
    });

    if (!shouldSend) continue;

    const to = process.env.ALERTS_TO_EMAIL ?? alert.user.email;
    const bucket = triggeredByUser.get(to) ?? [];
    bucket.push({
      alertId: alert.id,
      productName: alert.product.name,
      reasons,
      latestPrice: timing.latestPrice,
      changePct: timing.changePct,
      dropFromLast7Pct: timing.dropFromLast7Pct,
      confidencePct: timing.confidencePct,
      signal: timing.signal,
    });
    triggeredByUser.set(to, bucket);
  }

  for (const [to, items] of Array.from(triggeredByUser.entries())) {
    const buyNowItems = items
      .filter((item) => item.signal === "kjop-na")
      .sort((left, right) => (right.dropFromLast7Pct ?? -999) - (left.dropFromLast7Pct ?? -999));
    const top3BuyNow = buyNowItems.slice(0, 3);
    const buyNowCount = buyNowItems.length;
    const targetReachedCount = items.filter((item) => item.reasons.includes("target-price")).length;
    const priceDropCount = items.filter((item) => item.reasons.includes("price-drop-opportunity")).length;
    const subject = `Billigkurven ukesignal: ${items.length} vare${items.length === 1 ? "" : "r"} krever handling`;
    const bodyLines = [
      `Handlekurv-signal: ${items.length} aktive triggere`,
      `Kjop-na signaler: ${buyNowCount}`,
      `Malpris oppnadd: ${targetReachedCount}`,
      `Prisfallmuligheter: ${priceDropCount}`,
      "",
      "Topp 3 kjop-na akkurat na:",
      ...(top3BuyNow.length === 0
        ? ["- Ingen sterke kjop-na signaler akkurat na."]
        : top3BuyNow.map(
            (item, index) =>
              `${index + 1}. ${item.productName} | pris: ${item.latestPrice ?? "-"} | 7d-fall: ${item.dropFromLast7Pct ?? "-"}% | confidence: ${item.confidencePct ?? "-"}%`,
          )),
      "",
      "Produkter:",
      ...items.slice(0, 20).map((item) =>
        `- ${item.productName} | signal: ${item.signal} | pris: ${item.latestPrice ?? "-"} | 7d trend: ${item.changePct ?? "-"}% | 7d fall: ${item.dropFromLast7Pct ?? "-"}% | utløsere: ${item.reasons.join(", ")}`,
      ),
      "",
      "Aapne appen for a se samlet butikkanbefaling for denne uken.",
    ];

    await sendAlertMessage({
      to,
      subject,
      body: bodyLines.join("\n"),
      channel: "email",
      kind: "basket-digest",
      metrics: {
        triggeredItems: items.length,
        buyNowCount,
        targetReachedCount,
      },
    });

    await sendAlertMessage({
      to,
      subject: `${subject} (push)` ,
      body: bodyLines.slice(0, 14).join("\n"),
      channel: "push",
      kind: "basket-digest-push",
      metrics: {
        triggeredItems: items.length,
        buyNowCount,
        targetReachedCount,
      },
    });

    for (const item of items) {
      await prisma.priceAlert.update({
        where: { id: item.alertId },
        data: { lastTriggeredAt: new Date() },
      });
    }

    sentCount += 1;
  }

  return {
    scanned: activeAlerts.length,
    sent: sentCount,
    triggered: evaluations.filter((item) => item.triggered).length,
    evaluations,
  };
}
