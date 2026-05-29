const hosts = ["meny.no", "spar.no", "joker.no"];

async function main() {
  for (const host of hosts) {
    const response = await fetch(`https://${host}/sok?q=tine%20lettmelk`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    const html = await response.text();
    const idx = html.toLowerCase().indexOf("chainid");
    console.log(`--- ${host} idx=${idx}`);
    if (idx >= 0) {
      console.log(html.slice(Math.max(0, idx - 220), idx + 220));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
