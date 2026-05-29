const hosts = ["meny.no", "spar.no", "joker.no"];

async function main() {
  const regex = /"chainId"\s*:\s*"?(\d+)"?/i;

  for (const host of hosts) {
    const response = await fetch(`https://${host}/sok?q=tine%20lettmelk`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    const html = await response.text();
    const match = html.match(regex);
    console.log(`${host}: ${match?.[1] ?? "unknown"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
