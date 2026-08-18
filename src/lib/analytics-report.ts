import { readLocalEvents } from "@/lib/local-event-log";

type SectionConfig = {
  key: string;
  label: string;
  impressions: string[];
  clicks: string[];
};

export type SectionAnalyticsRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  clickRate: number;
};

const sectionConfigs: SectionConfig[] = [
  {
    key: "home-estimator",
    label: "Forside: Spareestimator",
    impressions: ["home-estimator"],
    clicks: ["savings_estimator_compare_clicked", "savings_estimator_onboarding_clicked"],
  },
  {
    key: "home-competitive-position",
    label: "Forside: Konkurranseposisjon",
    impressions: ["home-competitive-position"],
    clicks: [],
  },
  {
    key: "home-trust-cta",
    label: "Forside: Tillits-CTA",
    impressions: ["home-trust-cta"],
    clicks: ["home_trust_cta_clicked"],
  },
  {
    key: "compare-action-plan",
    label: "Compare: Kjøp nå/vent-plan",
    impressions: ["compare-action-plan"],
    clicks: [],
  },
  {
    key: "compare-trust-cta",
    label: "Compare: Tillits-CTA",
    impressions: ["compare-trust-cta"],
    clicks: ["compare_trust_cta_clicked"],
  },
  {
    key: "alerts-basket-strategy",
    label: "Alerts: Kurvstrategi",
    impressions: ["alerts-basket-strategy"],
    clicks: [],
  },
];

function round(value: number) {
  return Number(value.toFixed(1));
}

export async function getSectionAnalyticsReport() {
  const events = await readLocalEvents(12000);

  const rows: SectionAnalyticsRow[] = sectionConfigs.map((config) => {
    const impressions = events.filter(
      (event) =>
        event.eventName === "section_impression" &&
        config.impressions.includes(String(event.eventProps?.sectionId ?? "")),
    ).length;

    const clicks = events.filter((event) => config.clicks.includes(event.eventName)).length;
    const clickRate = impressions > 0 ? round((clicks / impressions) * 100) : 0;

    return {
      key: config.key,
      label: config.label,
      impressions,
      clicks,
      clickRate,
    };
  });

  const trackedEvents = events.length;
  const firstSeen = events[0]?.at ?? null;
  const lastSeen = events[events.length - 1]?.at ?? null;

  return {
    rows,
    trackedEvents,
    firstSeen,
    lastSeen,
  };
}
