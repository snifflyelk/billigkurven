"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";
import { formatNok } from "@/lib/utils";

type ProductResult = {
  id: string;
  name: string;
  brand: string;
};

type ListItem = {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    brand: string;
    category?: string;
    prices?: Array<{ price: unknown }>;
  };
};

function estimateItemPrice(item: ListItem) {
  const values = (item.product.prices ?? [])
    .map((entry) => Number(entry.price))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function ShoppingListEditor({
  shoppingListId,
  initialItems,
}: {
  shoppingListId: string;
  initialItems: ListItem[];
}) {
  const [query, setQuery] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  const productSearch = useQuery({
    queryKey: ["product-search", query],
    queryFn: async () => {
      if (!query.trim()) return [] as ProductResult[];
      const data = await apiRequest<{ products: ProductResult[] }>(`/api/products/search?q=${encodeURIComponent(query)}`);
      return data.products;
    },
  });

  const items = useMemo(
    () => (queryClient.getQueryData(["list-items", shoppingListId]) as ListItem[] | undefined) ?? initialItems,
    [initialItems, queryClient, shoppingListId],
  );

  const groupedItems = useMemo(() => {
    return items.reduce<Record<string, ListItem[]>>((acc, item) => {
      const category = item.product.category?.trim() || "Uten kategori";
      acc[category] = acc[category] ?? [];
      acc[category].push(item);
      return acc;
    }, {});
  }, [items]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const unitPrice = estimateItemPrice(item);
      return sum + (unitPrice !== null ? unitPrice * item.quantity : 0);
    }, 0);
  }, [items]);

  const addItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest<{ item: ListItem }>("/api/shopping-list/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shoppingListId, productId, quantity: 1 }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      router.refresh();
    },
    onError: (error, productId) => {
      showToast({
        title: "Kunne ikke legge til vare",
        description: toUserErrorMessage(error),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: () => addItemMutation.mutate(productId),
      });
    },
  });

  const updateQtyMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      await apiRequest<{ item: ListItem }>("/api/shopping-list/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      router.refresh();
    },
    onError: (error, variables) => {
      showToast({
        title: "Kunne ikke oppdatere antall",
        description: toUserErrorMessage(error),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: () => updateQtyMutation.mutate(variables),
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest<{ ok: boolean }>(`/api/shopping-list/items?itemId=${itemId}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      router.refresh();
    },
    onError: (error, itemId) => {
      showToast({
        title: "Kunne ikke fjerne vare",
        description: toUserErrorMessage(error),
        type: "error",
        actionLabel: "Prøv igjen",
        onAction: () => removeItemMutation.mutate(itemId),
      });
    },
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-sm font-semibold">Søk etter vare</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-emerald-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          placeholder="f.eks. melk"
        />
        {productSearch.data && productSearch.data.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {productSearch.data.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => addItemMutation.mutate(product.id)}
              >
                <span>
                  {product.name} - {product.brand}
                </span>
                <span className="font-semibold text-emerald-600">Legg til</span>
              </button>
            ))}
          </div>
        ) : query.trim() && !productSearch.isLoading ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Ingen treff på &quot;{query}&quot;.
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Varer i handlelisten</h2>
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Estimert total: {formatNok(estimatedTotal)}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Handlelisten er tom. Legg til varer over.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <section key={category}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{category}</h3>
                <div className="space-y-2">
                  {categoryItems.map((item) => {
                    const unitPrice = estimateItemPrice(item);
                    const lineTotal = unitPrice !== null ? unitPrice * item.quantity : null;
                    const checked = checkedIds.has(item.id);

                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setCheckedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium ${checked ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-current text-[10px]">
                              {checked ? "✓" : ""}
                            </span>
                            {item.product.name}
                          </button>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateQtyMutation.mutate({ itemId: item.id, quantity: Number(e.target.value) })
                              }
                              className="h-10 w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <button
                              type="button"
                              className="h-10 rounded-lg border border-rose-300 px-3 py-1 text-sm font-semibold text-rose-600"
                              onClick={() => removeItemMutation.mutate(item.id)}
                            >
                              Fjern
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.product.brand}</span>
                          <span>Pris per vare: {unitPrice !== null ? formatNok(unitPrice) : "-"}</span>
                          <span>Linjesum: {lineTotal !== null ? formatNok(lineTotal) : "-"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/compare" className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
            Se hvor du sparer mest på denne listen
          </a>
          <p className="self-center text-sm text-slate-500 dark:text-slate-400">Tips: sammenligning viser differanse i kroner og prosent per butikk.</p>
        </div>
      </div>
    </section>
  );
}
