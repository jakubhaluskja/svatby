import { describe, expect, it } from "vitest";
import { czAccountToIban, isValidIban, spayd, toIban } from "./payment-qr";

describe("QR platba", () => {
  it("převede české číslo účtu na IBAN", () => {
    expect(czAccountToIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
    expect(czAccountToIban("2000145399/0800")).toBe("CZ7908000000002000145399");
  });

  it("odmítne neplatné číslo účtu", () => {
    expect(czAccountToIban("123456789/0800")).toBeNull();
    expect(czAccountToIban("nesmysl")).toBeNull();
  });

  it("ověří IBAN", () => {
    expect(isValidIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
    expect(isValidIban("CZ66 0800 0000 1920 0014 5399")).toBe(false);
    expect(toIban("cz6508000000192000145399")).toBe("CZ6508000000192000145399");
  });

  it("sestaví SPAYD bez diakritiky a hvězdiček", () => {
    expect(spayd({ iban: "CZ6508000000192000145399", message: "Svatební dar*" })).toBe(
      "SPD*1.0*ACC:CZ6508000000192000145399*CC:CZK*MSG:Svatebni dar",
    );
    expect(spayd({ iban: "CZ6508000000192000145399", amount: 500 })).toContain("AM:500.00");
  });
});
