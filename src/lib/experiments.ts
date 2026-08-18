export type ExperimentVariant = "control" | "variant";

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getExperimentVariant(experimentKey: string, subjectKey: string): ExperimentVariant {
  const value = hashString(`${experimentKey}:${subjectKey}`);
  return value % 2 === 0 ? "control" : "variant";
}
