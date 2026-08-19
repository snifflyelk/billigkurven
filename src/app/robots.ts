import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/product/", "/insights/", "/pricing", "/coverage", "/confidence", "/status"],
      disallow: [
        "/varer",
        "/api/",
        "/admin/",
        "/account",
        "/alerts",
        "/benchmark",
        "/compare",
        "/data-quality",
        "/distribution/analytics",
        "/login",
        "/onboarding",
        "/ops",
        "/receipts",
        "/savings",
        "/shopping-list",
      ],
    },
  };
}