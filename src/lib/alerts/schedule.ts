export function getAlertDigestScheduleConfig() {
  return {
    localHour: Number(process.env.ALERT_DIGEST_HOUR ?? "9"),
  };
}

export function shouldRunAlertDigestNow(now = new Date()) {
  const { localHour } = getAlertDigestScheduleConfig();
  return now.getHours() === localHour;
}
