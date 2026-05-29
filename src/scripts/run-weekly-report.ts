import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getWeeklyReportScheduleConfig, shouldRunWeeklyReportNow } from "@/lib/weekly-report-schedule";
import { dispatchWeeklySavingsReport, type WeeklyReportChannel } from "@/lib/weekly-report-dispatch";

function readArg(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

async function main() {
  const force = process.argv.includes("--force");
  const channelArg = readArg("--channel");
  const chainArg = readArg("--chain");
  const channel: WeeklyReportChannel = channelArg === "push" ? "push" : "email";

  if (!force && !shouldRunWeeklyReportNow(new Date())) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "outside-schedule-window",
          schedule: getWeeklyReportScheduleConfig(),
        },
        null,
        2,
      ),
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL }, select: { id: true, email: true } });
  if (!user) {
    throw new Error("Standardbruker ikke funnet. Kjor onboarding forst.");
  }

  const result = await dispatchWeeklySavingsReport({
    userId: user.id,
    channel,
    chain: chainArg ?? null,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        executedAt: new Date().toISOString(),
        channel,
        chain: chainArg ?? null,
        fallback: result.fallback,
        delivered: result.delivered,
        schedule: getWeeklyReportScheduleConfig(),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
