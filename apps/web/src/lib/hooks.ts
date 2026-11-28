"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import { useActiveBusiness } from "./business";

/** Mutation with toasts and cache invalidation — the one pattern every form uses. */
export function useAction<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, opts: { success?: string | ((r: TRes) => string); invalidate?: string[]; onSuccess?: (r: TRes) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r) : opts.success);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      opts.onSuccess?.(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlaces() {
  const { id } = useActiveBusiness();
  return useQuery({ queryKey: ["places", id ?? ""], queryFn: () => api.get<import("./types").Place[]>("/locations"), staleTime: 60_000, enabled: !!id });
}
/** Items for the open business (its own plus shared ones), or all items when viewing everything. */
export function useProducts() {
  const { id } = useActiveBusiness();
  return useQuery({ queryKey: ["products", "pick", id ?? ""], queryFn: () => api.get<{ items: import("./summary").Product[] }>(`/products${id ? `?businessId=${id}` : ""}`) });
}

/** The family's businesses, for any picker. Cached, so every screen shares one request. */
export const useBusinesses = () => useQuery({ queryKey: ["businesses"], queryFn: () => api.get<import("./types").Business[]>("/businesses"), staleTime: 5 * 60_000 });
