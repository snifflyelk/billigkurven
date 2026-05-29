const target = process.argv[2] ?? "https://meny.no/sok?q=tine%20lettmelk";

async function main() {
  const response = await fetch(target, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await response.text();

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  const nextData = nextDataMatch?.[1] ?? "";

  const jsonLdMatches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const hasProductInJsonLd = jsonLdMatches.some((entry) => /"@type"\s*:\s*"Product"/i.test(entry[1] ?? ""));

  console.log(
    JSON.stringify(
      {
        target,
        status: response.status,
        htmlLength: html.length,
        hasVarePath: /\/varer\//i.test(html),
        nextDataLength: nextData.length,
        nextDataHasPrice: /"price"/i.test(nextData),
        nextDataHasProductLike: /product|search|results|hits|offers|price/i.test(nextData),
        jsonLdScripts: jsonLdMatches.length,
        hasProductInJsonLd,
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
