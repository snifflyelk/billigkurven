"use client";

export function PrintProofButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
    >
      Skriv ut / Lagre som PDF
    </button>
  );
}
