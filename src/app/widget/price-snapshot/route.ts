import { getPublicPriceSnapshot } from "@/lib/market-intelligence";

function esc(value: string) {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = (searchParams.get("city") ?? "Oslo").trim();

  const snapshot = await getPublicPriceSnapshot();
  const highlight = snapshot.highlights.find((row) => row.city.toLowerCase() === city.toLowerCase()) ?? snapshot.highlights[0];

  const html = `
(function(){
  var root=document.currentScript&&document.currentScript.parentElement?document.currentScript.parentElement:document.body;
  var card=document.createElement('div');
  card.style.cssText='font-family:Manrope,system-ui,sans-serif;border:1px solid #dbe4e3;border-radius:14px;padding:12px;max-width:360px;background:#f8fffc;color:#0f2d24;';
  card.innerHTML='<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#1f7666;font-weight:700;">Billigkurven snapshot</div>' +
                 '<div style="margin-top:6px;font-size:16px;font-weight:700;">'+${JSON.stringify(esc(highlight?.city ?? "Norge"))}+'</div>' +
                 '<div style="margin-top:4px;font-size:13px;">Billigst kjede: <strong>'+${JSON.stringify(esc(highlight?.winner ?? "Ukjent"))}+'</strong></div>' +
                 '<div style="margin-top:4px;font-size:13px;">Estimert kurv: <strong>'+((${JSON.stringify(highlight?.estimate ?? 0)}||0).toLocaleString('nb-NO'))+' kr</strong></div>' +
                 '<a href="https://billigkurven.vercel.app/insights" style="display:inline-block;margin-top:8px;font-size:12px;color:#0b5f4f;text-decoration:none;font-weight:700;">Se mer innsikt</a>';
  root.appendChild(card);
})();`;

  return new Response(html, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
