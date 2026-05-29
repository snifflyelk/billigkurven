export type LivePriceCandidate = {
  title: string;
  details: string;
  price: number;
  unitPrice: number;
  url: string;
  imageUrl?: string | null;
};

export type LivePriceProvider = {
  provider: string;
  storeName: string;
  chain: string;
  location: string;
  minScore?: number;
  search(query: string): Promise<LivePriceCandidate[]>;
};