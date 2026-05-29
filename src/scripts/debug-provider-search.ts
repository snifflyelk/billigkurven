import { odaProvider } from "@/lib/live-pricing/providers/oda";
import { menyProvider } from "@/lib/live-pricing/providers/meny";
import { sparProvider } from "@/lib/live-pricing/providers/spar";
import { jokerProvider } from "@/lib/live-pricing/providers/joker";

const providers = [odaProvider, menyProvider, sparProvider, jokerProvider];
const query = process.argv[2] ?? "tine lettmelk";

async function main() {
  const rows: Array<{ provider: string; count: number; first?: { title: string; price: number; url: string } }> = [];

  for (const provider of providers) {
    try {
      const candidates = await provider.search(query);
      rows.push({
        provider: provider.provider,
        count: candidates.length,
        first: candidates[0]
          ? {
              title: candidates[0].title,
              price: candidates[0].price,
              url: candidates[0].url,
            }
          : undefined,
      });
    } catch (error) {
      rows.push({
        provider: provider.provider,
        count: -1,
        first: {
          title: error instanceof Error ? error.message : String(error),
          price: 0,
          url: "",
        },
      });
    }
  }

  console.log(JSON.stringify({ query, rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
