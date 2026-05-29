import { createNorgesgruppenProvider } from "./norgesgruppen";

export const sparProvider = createNorgesgruppenProvider({
  provider: "spar",
  host: "spar.no",
  chainId: "1210",
  storeName: "SPAR Nettbutikk",
  chain: "SPAR",
  minScore: 3.2,
  glnEnvKey: "NORGESGRUPPEN_SPAR_GLN",
});
