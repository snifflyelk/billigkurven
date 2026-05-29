type ChainConfig = {
  provider: "meny" | "spar" | "joker";
  chainId: string;
  envKey: string;
  fallback: string;
};

const SCAN_LIMIT = Number(process.env.LIVE_PRICING_GLN_SCAN_LIMIT ?? 30);
const SCAN_SPAN = Number(process.env.LIVE_PRICING_GLN_SCAN_SPAN ?? 80);

const chains: ChainConfig[] = [
  { provider: "meny", chainId: "1300", envKey: "NORGESGRUPPEN_MENY_GLN", fallback: "1300010110113" },
  { provider: "spar", chainId: "1210", envKey: "NORGESGRUPPEN_SPAR_GLN", fallback: "1210010110111" },
  { provider: "joker", chainId: "1220", envKey: "NORGESGRUPPEN_JOKER_GLN", fallback: "1220010110110" },
];

function parseCandidates(primary: string | undefined, candidateString: string | undefined, fallback: string) {
  const values = [primary ?? "", candidateString ?? "", fallback]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function zeroPadLike(template: string, numeric: number) {
  const width = template.length;
  const normalized = String(Math.max(0, Math.floor(numeric)));
  return normalized.length >= width ? normalized : `${"0".repeat(width - normalized.length)}${normalized}`;
}

function buildActiveCandidates(base: string, seeded: string[]) {
  const baseNum = Number(base);
  const candidates: string[] = [...seeded];

  if (Number.isFinite(baseNum)) {
    for (let offset = 1; offset <= SCAN_SPAN; offset += 1) {
      candidates.push(zeroPadLike(base, baseNum + offset));
      candidates.push(zeroPadLike(base, baseNum - offset));
      if (candidates.length >= SCAN_LIMIT * 4) break;
    }
  }

  return Array.from(new Set(candidates)).slice(0, Math.max(SCAN_LIMIT, seeded.length));
}

async function checkGln(chainId: string, gln: string) {
  const url = new URL(`https://api.ngdata.no/sylinder/search/productsearch/v1/search/${encodeURIComponent(gln)}/products`);
  url.searchParams.set("search", "tine melk");
  url.searchParams.set("chainId", chainId);
  url.searchParams.set("pageSize", "24");
  url.searchParams.set("page", "1");
  url.searchParams.set("showNotForSale", "true");
  url.searchParams.set("popularity", "true");

  const response = await fetch(url.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) return { ok: false, total: 0, status: response.status };

  const payload = (await response.json()) as { total?: unknown };
  const total = typeof payload.total === "number" ? payload.total : 0;
  return { ok: total > 0, total, status: response.status };
}

async function main() {
  const output: Array<{ provider: string; selected: string; tested: Array<{ gln: string; total: number; status: number }> }> = [];

  for (const chain of chains) {
    const primary = process.env[chain.envKey];
    const seededCandidates = parseCandidates(primary, process.env[`${chain.envKey}_CANDIDATES`], chain.fallback);
    const candidates = buildActiveCandidates(chain.fallback, seededCandidates);
    const tested: Array<{ gln: string; total: number; status: number }> = [];
    let selected = candidates[0] ?? chain.fallback;
    let bestTotal = -1;

    for (const gln of candidates) {
      const result = await checkGln(chain.chainId, gln).catch(() => ({ ok: false, total: 0, status: 0 }));
      tested.push({ gln, total: result.total, status: result.status });
      if (result.total > bestTotal) {
        bestTotal = result.total;
        selected = gln;
      }
      if (result.ok) {
        selected = gln;
        break;
      }
    }

    const ranked = tested.sort((a, b) => b.total - a.total).slice(0, 12);
    output.push({ provider: chain.provider, selected, tested: ranked });
  }

  console.log(JSON.stringify({ recommendations: output }, null, 2));
  console.log("\nRecommended .env lines:");
  for (const row of output) {
    const key = chains.find((chain) => chain.provider === row.provider)?.envKey;
    if (key) {
      console.log(`${key}="${row.selected}"`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
