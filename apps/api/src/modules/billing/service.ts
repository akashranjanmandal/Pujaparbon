import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { calcInvoice, istDateKey, type ExpenseInput, type InvoiceInput } from "@pp/shared";
import { db } from "../../db/client";
import { channels, expenses, invoiceItems, invoices, stockMovements, tenants, users, variants } from "../../db/schema";
import { conflict, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import { nextNumber } from "../../lib/numbering";
import type { AuthContext } from "../../lib/http";
import { recordMovement } from "../stock/service";
import { channelByCode } from "../orders/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export async function createInvoice(c: Ctx, input: InvoiceInput) {
  const id = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tenants).where(eq(tenants.id, c.tenantId));
    const ch = await channelByCode(tx, c.tenantId, input.channel);
    const totals = calcInvoice(
      input.items.map((i) => ({ ratePaise: i.ratePaise, qty: i.qty, gstRate: i.gstRate, inclusive: input.pricesInclusive })),
      { sellerState: t.state, placeOfSupply: input.placeOfSupply },
    );
    const variantIds = input.items.map((i) => i.variantId).filter(Boolean) as string[];
    if (variantIds.length) {
      const found = await tx.select({ id: variants.id }).from(variants).where(and(eq(variants.tenantId, c.tenantId), inArray(variants.id, variantIds)));
      if (found.length !== new Set(variantIds).size) throw notFound("SKU");
    }
    const [inv] = await tx
      .insert(invoices)
      .values({
        tenantId: c.tenantId, number: await nextNumber(tx, c.tenantId, "INV"), date: istDateKey(), channelId: ch.id,
        customerName: input.customerName, customerGstin: input.customerGstin ?? null, placeOfSupply: input.placeOfSupply,
        subtotalPaise: totals.subtotalPaise, cgstPaise: totals.cgstPaise, sgstPaise: totals.sgstPaise, igstPaise: totals.igstPaise,
        totalPaise: totals.totalPaise, createdById: c.userId,
      })
      .returning();
    for (const [i, item] of input.items.entries()) {
      const line = totals.lines[i];
      await tx.insert(invoiceItems).values({
        invoiceId: inv.id, variantId: item.variantId ?? null, description: item.description, hsn: item.hsn, qty: item.qty,
        ratePaise: item.ratePaise, gstRate: item.gstRate, taxablePaise: line.taxablePaise, taxPaise: line.taxPaise,
      });
      if (input.deductStock && item.variantId) {
        await recordMovement(tx, c, { variantId: item.variantId, qty: -item.qty, type: "SALE", reason: `Invoice ${inv.number}`, refType: "invoice", refId: inv.id });
      }
    }
    await audit(tx, c, "invoice.create", "invoice", inv.id, { totalPaise: totals.totalPaise });
    return inv.id;
  });
  return getInvoice(c.tenantId, id);
}

export async function getInvoice(tenantId: string, id: string) {
  const [r] = await db
    .select({ inv: invoices, channelName: channels.name, t: tenants })
    .from(invoices)
    .leftJoin(channels, eq(channels.id, invoices.channelId))
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
  if (!r) throw notFound("Invoice");
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return { ...r.inv, channelName: r.channelName, items, seller: { name: r.t.name, address: r.t.address, gstin: r.t.gstin, state: r.t.state } };
}

export async function listInvoices(tenantId: string) {
  const rows = await db
    .select({ inv: invoices, channelName: channels.name, by: users.name })
    .from(invoices)
    .leftJoin(channels, eq(channels.id, invoices.channelId))
    .leftJoin(users, eq(users.id, invoices.createdById))
    .where(eq(invoices.tenantId, tenantId))
    .orderBy(desc(invoices.createdAt))
    .limit(300);
  const items = rows.map((r) => ({ ...r.inv, channelName: r.channelName, by: r.by }));
  const month = istDateKey().slice(0, 7);
  const thisMonth = items.filter((i) => i.date.startsWith(month) && i.status === "ISSUED");
  return {
    items,
    summary: {
      monthCount: thisMonth.length,
      monthTotalPaise: thisMonth.reduce((s, i) => s + i.totalPaise, 0),
      monthTaxPaise: thisMonth.reduce((s, i) => s + i.cgstPaise + i.sgstPaise + i.igstPaise, 0),
    },
  };
}

/** Cancelling puts invoiced stock back on the shelf. Invoice numbers are never reused. */
export async function cancelInvoice(c: Ctx, id: string) {
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, c.tenantId)));
    if (!inv) throw notFound("Invoice");
    if (inv.status === "CANCELLED") throw conflict("Invoice is already cancelled");
    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const [moved] = await tx
      .select({ n: sql<number>`count(*)` })
      .from(stockMovements)
      .where(and(eq(stockMovements.refType, "invoice"), eq(stockMovements.refId, id)));
    if (Number(moved?.n ?? 0) > 0) {
      for (const i of items.filter((x) => x.variantId)) {
        await recordMovement(tx, c, { variantId: i.variantId!, qty: i.qty, type: "RETURN", reason: `Invoice ${inv.number} cancelled`, refType: "invoice", refId: id });
      }
    }
    await tx.update(invoices).set({ status: "CANCELLED" }).where(eq(invoices.id, id));
    await audit(tx, c, "invoice.cancel", "invoice", id);
  });
  return getInvoice(c.tenantId, id);
}

/* ------------------------------ Expenses ----------------------------- */

export async function listExpenses(tenantId: string, month?: string) {
  const where = [eq(expenses.tenantId, tenantId)];
  if (month) where.push(gte(expenses.date, `${month}-01`), lte(expenses.date, `${month}-31`));
  const items = await db.select().from(expenses).where(and(...where)).orderBy(desc(expenses.date)).limit(300);
  const byCategory: Record<string, number> = {};
  for (const e of items) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountPaise;
  return { items, totalPaise: items.reduce((s, e) => s + e.amountPaise, 0), byCategory };
}

export async function createExpense(c: Ctx, input: ExpenseInput) {
  const [row] = await db.insert(expenses).values({ ...input, note: input.note ?? null, tenantId: c.tenantId, createdById: c.userId }).returning();
  return row;
}

export async function deleteExpense(c: Ctx, id: string) {
  const res = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Expense");
  return { ok: true };
}
