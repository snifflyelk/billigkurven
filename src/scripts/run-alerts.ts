import { evaluateAndDispatchAlerts } from "@/lib/alerts/engine";

async function main() {
  const result = await evaluateAndDispatchAlerts();
  console.log(JSON.stringify({
    executedAt: new Date().toISOString(),
    scanned: result.scanned,
    triggered: result.triggered,
    sent: result.sent,
    sample: result.evaluations.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
