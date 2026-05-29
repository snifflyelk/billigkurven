import { createNorgesgruppenProvider } from "./norgesgruppen";

export const jokerProvider = createNorgesgruppenProvider({
  provider: "joker",
  host: "joker.no",
  chainId: "1220",
  storeName: "Joker Nettbutikk",
  chain: "Joker",
  minScore: 3.2,
  glnEnvKey: "NORGESGRUPPEN_JOKER_GLN",
});
