import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

type TimingSignal = "kjop-na" | "vent" | "noytral" | "ukjent";

type ProductTiming = {
  latestPrice: number | null;
  changePct: number | null;
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
  signal: TimingSignal;
};

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function buildProductTiming(productId: string): Promise<ProductTiming> {
  const rows = await prisma.price.findMany({
    where: { productId, isQuarantined: false },
    orderBy: { date: "desc" },
    take: 300,
    select: { price: true, date: true },
  });

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const last7 = rows.filter((row) => nowMs - row.date.getTime() <= 7 * dayMs).map((row) => Number(row.price));
  const prev7 = rows
    .filter((row) => {
      const age = nowMs - row.date.getTime();
      return age > 7 * dayMs && age <= 14 * dayMs;
    })
    .map((row) => Number(row.price));

  const latestPrice = rows[0] ? Number(rows[0].price) : null;
  const last7Avg = avg(last7);
  const prev7Avg = avg(prev7);
  const changePct =
    last7Avg !== null && prev7Avg !== null && prev7Avg > 0
      ? Number((((last7Avg - prev7Avg) / prev7Avg) * 100).toFixed(1))
      : null;

  const signal: TimingSignal = changePct === null ? "ukjent" : changePct <= -3 ? "kjop-na" : changePct >= 3 ? "vent" : "noytral";
  return { latestPrice, changePct, signal };
}

async function writeLogLine(line: string) {
  const logsDir = path.join(process.cwd(), "logs");
  await mkdir(logsDir, { recursive: true });
  await appendFile(path.join(logsDir, "alert-events.log"), `${line}\n`, "utf8");
}

async function sendAlertMessage(args: {
  to: string;
  productName: string;
  reasons: string[];
  latestPrice: number | null;
  changePct: number | null;
  signal: TimingSignal;
}) {
  const host = process.env.ALERT_SMTP_HOST;
  const port = Number(process.env.ALERT_SMTP_PORT ?? "587");
  const user = process.env.ALERT_SMTP_USER;
  const pass = process.env.ALERT_SMTP_PASS;
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@billigkurven.local";

  const subject = `Billigkurven varsel: ${args.productName}`;
  const body = [
    `Produkt: ${args.productName}`,
    `Signal: ${args.signal}`,
    `Siste pris: ${args.latestPrice ?? "-"}`,
    `7d endring: ${args.changePct ?? "-"}%`,
    `Utlosere: ${args.reasons.join(", ")}`,
  ].join("\n");

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
      subject,
      text: body,
    });
    return "email" as const;
  }

  await writeLogLine(
    JSON.stringify({
      at: new Date().toISOString(),
      to: args.to,
      subject,
      body,
      channel: "log-fallback",
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
  let sentCount = 0;

  for (const alert of activeAlerts) {
    const timing = await buildProductTiming(alert.productId);
    const reasons: string[] = [];

    if (alert.targetPrice !== null && timing.latestPrice !== null && timing.latestPrice <= Number(alert.targetPrice)) {
      reasons.push("target-price");
    }

    if (alert.targetDropPct !== null && timing.changePct !== null && timing.changePct <= -alert.targetDropPct) {
      reasons.push("target-drop-pct");
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
      signal: timing.signal,
    });

    if (!shouldSend) continue;

    const to = process.env.ALERTS_TO_EMAIL ?? alert.user.email;
    await sendAlertMessage({
      to,
      productName: alert.product.name,
      reasons,
      latestPrice: timing.latestPrice,
      changePct: timing.changePct,
      signal: timing.signal,
    });

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { lastTriggeredAt: new Date() },
    });

    sentCount += 1;
  }

  return {
    scanned: activeAlerts.length,
    sent: sentCount,
    triggered: evaluations.filter((item) => item.triggered).length,
    evaluations,
  };
}
