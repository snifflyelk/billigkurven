const target = process.argv[2] ?? "https://meny.no/sok?q=tine%20lettmelk";

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) return null;
  return response.text();
}

async function main() {
  const html = await fetchText(target);
  if (!html) {
    console.log(JSON.stringify({ target, ok: false }, null, 2));
    return;
  }

  const scriptUrls = Array.from(
    html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi),
    (entry) => entry[1],
  )
    .map((src) => (src.startsWith("http") ? src : new URL(src, target).toString()))
    .filter((src) => /_next\/static\/chunks/i.test(src));

  const uniqueScripts = Array.from(new Set(scriptUrls)).slice(0, 20);
  const findings: Array<{ script: string; matches: string[] }> = [];

  for (const scriptUrl of uniqueScripts) {
    const content = await fetchText(scriptUrl);
    if (!content) continue;

    const matches = Array.from(
      content.matchAll(/(?:https?:\/\/[^"'\s]+|\/(?:api|graphql|search|varer)[^"'\s]*)/gi),
      (entry) => entry[0],
    )
      .filter((value) => /api|search|graphql|varer|inventory|product|price|token/i.test(value))
      .slice(0, 40);

    const deduped = Array.from(new Set(matches));
    if (deduped.length > 0) {
      findings.push({
        script: scriptUrl,
        matches: deduped,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        target,
        scriptsScanned: uniqueScripts.length,
        findings,
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
