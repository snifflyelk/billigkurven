"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/toast-provider";
import { apiRequest, toUserErrorMessage } from "@/lib/api-client";

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
  };
};

export function ShoppingListEditor({
  shoppingListId,
  initialItems,
}: {
  shoppingListId: string;
  initialItems: ListItem[];
}) {
  const [query, setQuery] = useState("");
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
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-sm font-medium">Sok etter vare</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          placeholder="f.eks. melk"
        />
        {productSearch.data && productSearch.data.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {productSearch.data.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => addItemMutation.mutate(product.id)}
              >
                <span>
                  {product.name} - {product.brand}
                </span>
                <span className="text-emerald-600">Legg til</span>
              </button>
            ))}
          </div>
        ) : query.trim() && !productSearch.isLoading ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            Ingen treff på &quot;{query}&quot;. Prøv en enklere varebetegnelse eller et annet merke.
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Varer i handlelisten</h2>
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
              Handlelisten er tom. Søk etter en vare over, eller gå tilbake til onboarding for en hurtigstart.
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-slate-500">{item.product.brand}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateQtyMutation.mutate({ itemId: item.id, quantity: Number(e.target.value) })
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-rose-300 px-3 py-1 text-rose-600"
                    onClick={() => removeItemMutation.mutate(item.id)}
                  >
                    Fjern
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500">Tips: Gå til sammenligning for estimert besparelse.</p>
      </div>
    </section>
  );
}
