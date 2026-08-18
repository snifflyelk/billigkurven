import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = ["Meieri", "Frukt", "Grønt", "Pålegg", "Drikke", "Frossen"];

const sampleProducts = [
  { name: "Tine Lettmelk 1L", brand: "Tine", category: "Meieri" },
  { name: "Q Helmelk 1L", brand: "Q-Meieriene", category: "Meieri" },
  { name: "Prior Egg 12pk", brand: "Prior", category: "Pålegg" },
  { name: "Bama Banan", brand: "Bama", category: "Frukt" },
  { name: "Gulrot 1kg", brand: "Bama", category: "Grønt" },
  { name: "Gilde Kyllingfilet 700g", brand: "Gilde", category: "Frossen" },
  { name: "Coca-Cola Zero 1,5L", brand: "Coca-Cola", category: "Drikke" },
  { name: "Pepsi Max 1,5L", brand: "Pepsi", category: "Drikke" },
  { name: "Mills Kaviar", brand: "Mills", category: "Pålegg" },
  { name: "Jarlsberg Original", brand: "Tine", category: "Meieri" },
  { name: "Grandiosa Original", brand: "Stabburet", category: "Frossen" },
  { name: "Toro Tomatsuppe", brand: "Toro", category: "Pålegg" },
];

const products = Array.from({ length: 30 }).map((_, i) => {
  const idx = i + 1;
  const sample = sampleProducts[i % sampleProducts.length];
  return {
    name: `${sample.name} ${idx}`,
    brand: sample.brand,
    ean: `5700000000${String(idx).padStart(3, "0")}`,
    category: sample.category ?? categories[i % categories.length],
    imageUrl: `https://picsum.photos/seed/billigkurven-${idx}/320/220`,
  };
});

const stores = [
  { name: "Kiwi St. Hanshaugen", chain: "Kiwi", location: "Oslo", postalCode: "0451" },
  { name: "Rema 1000 Majorstuen", chain: "Rema 1000", location: "Oslo", postalCode: "0350" },
  { name: "Coop Extra Tøyen", chain: "Coop Extra", location: "Oslo", postalCode: "0652" },
  { name: "Meny Carl Berner", chain: "Meny", location: "Oslo", postalCode: "0566" },
  { name: "Bunnpris Bislett", chain: "Bunnpris", location: "Oslo", postalCode: "0170" },
];

const users = [
  { email: "ida@billigkurven.no" },
  { email: "martin@billigkurven.no" },
  { email: "sara@billigkurven.no" },
];

async function main() {
  await prisma.price.deleteMany();
  await prisma.priceAlert.deleteMany();
  await prisma.shoppingListItem.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.receiptSubmission.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  const createdProducts = await prisma.product.createManyAndReturn({ data: products });
  const createdStores = await prisma.store.createManyAndReturn({ data: stores });
  const createdUsers = await prisma.user.createManyAndReturn({ data: users });

  for (const user of createdUsers) {
    await prisma.userPreference.create({
      data: {
        userId: user.id,
        primaryStore: createdStores[Math.floor(Math.random() * createdStores.length)].name,
        priceSensitivity: 50 + Math.floor(Math.random() * 50),
      },
    });
  }

  const createdLists = [];
  for (const user of createdUsers) {
    const list = await prisma.shoppingList.create({ data: { userId: user.id } });
    createdLists.push(list);
  }

  for (const list of createdLists) {
    const sampled = createdProducts.sort(() => 0.5 - Math.random()).slice(0, 8);
    await prisma.shoppingListItem.createMany({
      data: sampled.map((product) => ({
        shoppingListId: list.id,
        productId: product.id,
        quantity: 1 + Math.floor(Math.random() * 4),
      })),
    });
  }

  const now = Date.now();
  const rows = [] as {
    productId: string;
    storeId: string;
    price: number;
    unitPrice: number;
    date: Date;
  }[];

  for (const product of createdProducts) {
    for (const store of createdStores) {
      for (let d = 0; d < 2; d++) {
        const base = 18 + (Number(product.ean.slice(-2)) % 13) * 4 + (d * 0.7);
        const storeFactor = 1 + createdStores.indexOf(store) * 0.04;
        const finalPrice = Number((base * storeFactor).toFixed(2));
        rows.push({
          productId: product.id,
          storeId: store.id,
          price: finalPrice,
          unitPrice: Number((finalPrice / (0.6 + (Number(product.ean.slice(-1)) % 6) * 0.2)).toFixed(2)),
          date: new Date(now - d * 7 * 24 * 60 * 60 * 1000),
        });
      }
    }
  }

  await prisma.price.createMany({ data: rows });

  const receiptPreview =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">
        <rect width="100%" height="100%" fill="#f8fafc"/>
        <text x="40" y="80" font-family="Arial" font-size="32" fill="#0f172a">KVITTERING</text>
        <text x="40" y="150" font-family="Arial" font-size="22" fill="#334155">Kiwi St. Hanshaugen</text>
        <text x="40" y="200" font-family="Arial" font-size="18" fill="#334155">Melk 2 stk - 31,90</text>
        <text x="40" y="240" font-family="Arial" font-size="18" fill="#334155">Egg - 44,90</text>
        <text x="40" y="320" font-family="Arial" font-size="28" fill="#059669">Totalt: 76,80</text>
      </svg>
    `);

  for (let i = 0; i < 4; i++) {
    await prisma.receiptSubmission.create({
      data: {
        userId: createdUsers[i % createdUsers.length].id,
        fileName: `kvittering-${i + 1}.svg`,
        imageDataUrl: receiptPreview,
        recognizedText: `Kiwi St. Hanshaugen\nMelk 2 x 15,95\nEgg 44,90\nMVA 7,68\nTotalt 76,80`,
        recognizedItems: [
          { label: "Melk", amount: 31.9, quantity: 2, unitPrice: 15.95, kind: "item" },
          { label: "Egg", amount: 44.9, kind: "item" },
          { label: "MVA", amount: 7.68, kind: "tax" },
        ],
        detectedStore: createdStores[i % createdStores.length].name,
        detectedTotal: Number((61 + i * 8.5).toFixed(2)),
        notes: i % 2 === 0 ? "Mistenkt manuell avvik, bør sjekkes." : "Ser konsistent ut.",
      },
    });
  }

  console.log(`Seed complete: ${createdProducts.length} products, ${createdStores.length} stores, ${rows.length} prices, ${createdUsers.length} users, ${createdLists.length} shopping lists`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
