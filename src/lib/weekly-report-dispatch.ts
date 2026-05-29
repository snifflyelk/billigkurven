import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";
import { getWeeklySavingsReport } from "@/lib/savings-report";
import { formatNok } from "@/lib/utils";

export type WeeklyReportChannel = "email" | "push";

export async function dispatchWeeklySavingsReport(args: {
  userId: string;
  chain?: string | null;
  channel: WeeklyReportChannel;
}) {
  const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { email: true } });
  if (!user) {
    throw new Error("Bruker ikke funnet for ukentlig rapport.");
  }

  const report = await getWeeklySavingsReport(args.userId, { chain: args.chain ?? null });

  const summaryLines = [
    `Ukentlig sparerapport`,
    `Uke spart: ${formatNok(report.thisWeekSavings)}`,
    `Forrige uke: ${formatNok(report.previousWeekSavings)}`,
    `Uke over uke: ${report.weekOverWeekDelta >= 0 ? "+" : "-"}${formatNok(Math.abs(report.weekOverWeekDelta))}`,
    `Neste uke (proj.): ${formatNok(report.projectedNextWeekSavings)}`,
    `Kjede-filter: ${report.selectedChain ?? "Alle"}`,
  ];

  if (args.channel === "email") {
    const host = process.env.ALERT_SMTP_HOST;
    const port = Number(process.env.ALERT_SMTP_PORT ?? "587");
    const smtpUser = process.env.ALERT_SMTP_USER;
    const smtpPass = process.env.ALERT_SMTP_PASS;
    const from = process.env.ALERT_FROM_EMAIL ?? "alerts@billigkurven.local";

    if (host && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from,
        to: process.env.ALERTS_TO_EMAIL ?? user.email,
        subject: "Billigkurven: Ukentlig sparerapport",
        text: summaryLines.join("\n"),
      });

      return {
        delivered: true,
        channel: "email" as const,
        fallback: false,
        summary: summaryLines,
      };
    }
  }

  const logsDir = path.join(process.cwd(), "logs");
  await mkdir(logsDir, { recursive: true });
  await appendFile(
    path.join(logsDir, "weekly-report-events.log"),
    `${JSON.stringify({ at: new Date().toISOString(), channel: args.channel, to: user.email, summary: summaryLines })}\n`,
    "utf8",
  );

  return {
    delivered: false,
    channel: args.channel,
    fallback: true,
    summary: summaryLines,
  };
}
