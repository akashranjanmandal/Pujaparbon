import { describe, expect, it } from "vitest";
import { numberToWords, rupeesInWords } from "./words";

describe("amount in words (Indian system)", () => {
  it("reads lakhs and crores", () => {
    expect(numberToWords(123456)).toBe("One Lakh Twenty Three Thousand Four Hundred Fifty Six");
    expect(numberToWords(10000000)).toBe("One Crore");
    expect(numberToWords(33000)).toBe("Thirty Three Thousand");
  });
  it("includes paise", () => {
    expect(rupeesInWords(105050)).toBe("Rupees One Thousand Fifty and Fifty Paise Only");
  });
});
