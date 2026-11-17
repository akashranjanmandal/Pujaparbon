"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { StockItem } from "@/app/(app)/stock/page";

/** Flat SKU list for pickers (purchases, invoices, returns). */
export const useSkus = () => useQuery({ queryKey: ["stock", ""], queryFn: () => api.get<{ items: StockItem[] }>("/stock").then((r) => r.items) });
