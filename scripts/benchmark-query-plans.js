const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const QUERIES = [
  {
    name: "price_recent_feed",
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT p."productId", p."storeId", p."date", p."price"
      FROM "Price" p
      WHERE p."isQuarantined" = false
      ORDER BY p."date" DESC
      LIMIT 4500;
    `,
  },
  {
    name: "price_by_store_window",
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT p."productId", p."storeId", p."date", p."price"
      FROM "Price" p
      WHERE p."isQuarantined" = false
        AND p."date" >= NOW() - INTERVAL '7 days'
        AND p."storeId" IN (
          SELECT s."id"
          FROM "Store" s
          WHERE s."postalCode" LIKE '0%'
          LIMIT 50
        )
      ORDER BY p."date" DESC
      LIMIT 180;
    `,
  },
  {
    name: "price_by_product_window",
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT p."productId", p."storeId", p."date", p."price"
      FROM "Price" p
      WHERE p."isQuarantined" = false
        AND p."date" >= NOW() - INTERVAL '45 days'
        AND p."productId" IN (
          SELECT pr."id"
          FROM "Product" pr
          WHERE pr."category" IS NOT NULL
          LIMIT 120
        )
      ORDER BY p."date" DESC
      LIMIT 320;
    `,
  },
  {
    name: "alerts_active_by_user",
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT a."id", a."userId", a."productId", a."isActive"
      FROM "PriceAlert" a
      WHERE a."userId" IN (
        SELECT u."id"
        FROM "User" u
        ORDER BY u."createdAt" DESC
        LIMIT 200
      )
        AND a."isActive" = true
      LIMIT 500;
    `,
  },
  {
    name: "receipts_reviewed_recent",
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT r."id", r."userId", r."reviewedAt", r."status"
      FROM "ReceiptSubmission" r
      WHERE r."status" = 'REVIEWED'
        AND r."reviewedAt" >= NOW() - INTERVAL '30 days'
      ORDER BY r."reviewedAt" DESC
      LIMIT 500;
    `,
  },
];

function walkPlan(node, acc) {
  if (!node || typeof node !== "object") return;

  const nodeType = node["Node Type"] || "";
  if (nodeType.includes("Seq Scan")) acc.seqScans += 1;
  if (nodeType.includes("Index Scan") || nodeType.includes("Index Only Scan") || nodeType.includes("Bitmap Index Scan")) {
    acc.indexScans += 1;
  }

  if (Array.isArray(node.Plans)) {
    for (const child of node.Plans) walkPlan(child, acc);
  }
}

function extractExplainRow(raw) {
  const first = raw?.[0];
  if (!first) return null;
  const key = Object.keys(first).find((k) => k.toLowerCase().includes("query plan"));
  if (!key) return null;

  const val = first[key];
  if (Array.isArray(val)) return val[0];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return null;
    }
  }
  return val;
}

async function runOne(query) {
  const raw = await prisma.$queryRawUnsafe(query.sql);
  const explained = extractExplainRow(raw);
  if (!explained) {
    return {
      name: query.name,
      planningMs: null,
      executionMs: null,
      totalMs: null,
      seqScans: 0,
      indexScans: 0,
      note: "Could not parse plan",
    };
  }

  const planningMs = explained["Planning Time"] ?? null;
  const executionMs = explained["Execution Time"] ?? null;
  const totalMs =
    typeof planningMs === "number" && typeof executionMs === "number"
      ? Number((planningMs + executionMs).toFixed(3))
      : null;

  const acc = { seqScans: 0, indexScans: 0 };
  walkPlan(explained.Plan, acc);

  return {
    name: query.name,
    planningMs,
    executionMs,
    totalMs,
    seqScans: acc.seqScans,
    indexScans: acc.indexScans,
    note: "ok",
  };
}

function fmtMs(value) {
  return typeof value === "number" ? value.toFixed(3) : "n/a";
}

async function main() {
  const results = [];
  for (const q of QUERIES) {
    results.push(await runOne(q));
  }

  console.log("Benchmark results (EXPLAIN ANALYZE):");
  for (const row of results) {
    console.log(
      [
        row.name,
        `planning=${fmtMs(row.planningMs)}ms`,
        `execution=${fmtMs(row.executionMs)}ms`,
        `total=${fmtMs(row.totalMs)}ms`,
        `seqScans=${row.seqScans}`,
        `indexScans=${row.indexScans}`,
        `note=${row.note}`,
      ].join(" | "),
    );
  }
}

main()
  .catch((error) => {
    console.error("Benchmark failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
