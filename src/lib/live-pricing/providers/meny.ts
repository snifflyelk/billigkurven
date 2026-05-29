import { createNorgesgruppenProvider } from "./norgesgruppen";

export const menyProvider = createNorgesgruppenProvider({
  provider: "meny",
  host: "meny.no",
  chainId: "1300",
  storeName: "MENY Nettbutikk",
  chain: "MENY",
  minScore: 3.0,
  glnEnvKey: "NORGESGRUPPEN_MENY_GLN",
});