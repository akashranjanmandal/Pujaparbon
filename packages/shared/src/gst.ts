export interface LineInput {
  ratePaise: number;
  qty: number;
  gstRate: number; // percent, e.g. 5, 12, 18
  inclusive: boolean; // marketplace prices are GST-inclusive
}

export interface LineResult {
  taxablePaise: number;
  taxPaise: number;
  totalPaise: number;
}

export function calcLine({ ratePaise, qty, gstRate, inclusive }: LineInput): LineResult {
  const gross = ratePaise * qty;
  if (inclusive) {
    const taxablePaise = Math.round((gross * 100) / (100 + gstRate));
    return { taxablePaise, taxPaise: gross - taxablePaise, totalPaise: gross };
  }
  const taxPaise = Math.round((gross * gstRate) / 100);
  return { taxablePaise: gross, taxPaise, totalPaise: gross + taxPaise };
}

export interface InvoiceTotals {
  lines: LineResult[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  interState: boolean;
}

export function calcInvoice(
  items: LineInput[],
  place: { sellerState: string; placeOfSupply: string },
): InvoiceTotals {
  const lines = items.map(calcLine);
  const interState = place.sellerState.trim().toLowerCase() !== place.placeOfSupply.trim().toLowerCase();
  const subtotalPaise = lines.reduce((s, l) => s + l.taxablePaise, 0);
  const tax = lines.reduce((s, l) => s + l.taxPaise, 0);
  const cgstPaise = interState ? 0 : Math.floor(tax / 2);
  const sgstPaise = interState ? 0 : tax - cgstPaise;
  return {
    lines,
    subtotalPaise,
    cgstPaise,
    sgstPaise,
    igstPaise: interState ? tax : 0,
    totalPaise: subtotalPaise + tax,
    interState,
  };
}
