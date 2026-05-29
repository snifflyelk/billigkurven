export type LiveCatalogItem = {
  name: string;
  brand: string;
  category: string;
  ean: string;
  imageUrl: string;
  packageQuantity?: number;
  packageUnit?: "G" | "ML" | "STK";
};

export const liveCatalog: LiveCatalogItem[] = [
  {
    name: "Lettmelk 1,0% 1,75 l",
    brand: "TINE",
    category: "Meieri",
    ean: "live-oda-0001",
    imageUrl: "https://picsum.photos/seed/live-melk/320/220",
    packageQuantity: 1750,
    packageUnit: "ML",
  },
  {
    name: "Helmelk 1 l",
    brand: "TINE",
    category: "Meieri",
    ean: "live-oda-0002",
    imageUrl: "https://picsum.photos/seed/live-helmelk/320/220",
  },
  {
    name: "Egg 12 stk",
    brand: "Prior",
    category: "Meieri",
    ean: "live-oda-0003",
    imageUrl: "https://picsum.photos/seed/live-egg/320/220",
  },
  {
    name: "Smør 500 g",
    brand: "TINE",
    category: "Meieri",
    ean: "live-oda-0004",
    imageUrl: "https://picsum.photos/seed/live-smor/320/220",
  },
  {
    name: "Grovbrød",
    brand: "Hatting",
    category: "Bakeri",
    ean: "live-oda-0005",
    imageUrl: "https://picsum.photos/seed/live-brod/320/220",
  },
  {
    name: "Bananer",
    brand: "First Price",
    category: "Frukt",
    ean: "live-oda-0006",
    imageUrl: "https://picsum.photos/seed/live-banan/320/220",
  },
  {
    name: "Tomat 400 g",
    brand: "Gartner",
    category: "Grønt",
    ean: "live-oda-0007",
    imageUrl: "https://picsum.photos/seed/live-tomat/320/220",
  },
  {
    name: "Agurk",
    brand: "Norsk",
    category: "Grønt",
    ean: "live-oda-0008",
    imageUrl: "https://picsum.photos/seed/live-agurk/320/220",
  },
  {
    name: "Kyllingfilet 700 g",
    brand: "Kyllinggården",
    category: "Kjøtt",
    ean: "live-oda-0009",
    imageUrl: "https://picsum.photos/seed/live-kylling/320/220",
  },
  {
    name: "Spagetti 500 g",
    brand: "Barilla",
    category: "Middag",
    ean: "live-oda-0010",
    imageUrl: "https://picsum.photos/seed/live-spagetti/320/220",
  },
  {
    name: "Norvegia 700 g",
    brand: "TINE",
    category: "Meieri",
    ean: "live-oda-0011",
    imageUrl: "https://picsum.photos/seed/live-ost/320/220",
  },
  {
    name: "Yoghurt Jordbær 1 kg",
    brand: "TINE",
    category: "Meieri",
    ean: "live-oda-0012",
    imageUrl: "https://picsum.photos/seed/live-yoghurt/320/220",
  },
];