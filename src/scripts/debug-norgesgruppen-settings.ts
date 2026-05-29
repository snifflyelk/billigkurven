const target = process.argv[2] ?? "https://meny.no/sok?q=tine%20lettmelk";

function tryParseSettings(raw: string) {
  const attempts = [
    raw,
    raw.replace(/\\\"/g, '"'),
  ];

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

async function main() {
  const response = await fetch(target, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await response.text();

  const match = html.match(/window\._siteGlobalSettings=(\{[\s\S]*?\});/);
  if (!match?.[1]) {
    console.log(JSON.stringify({ target, found: false }, null, 2));
    return;
  }

  const parsed = tryParseSettings(match[1]);
  if (!parsed) {
    console.log(
      JSON.stringify(
        {
          target,
          found: true,
          parsed: false,
          sample: match[1].slice(0, 300),
        },
        null,
        2,
      ),
    );
    return;
  }

  const keys = Object.keys(parsed).filter((key) => /url|search|product|api|token|inventory|price/i.test(key));
  const values = Object.fromEntries(keys.map((key) => [key, parsed[key]]));

  console.log(
    JSON.stringify(
      {
        target,
        found: true,
        parsed: true,
        values,
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

export {};
