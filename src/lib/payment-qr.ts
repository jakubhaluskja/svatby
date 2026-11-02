/**
 * QR platba (formát SPAYD / Short Payment Descriptor) pro české bankovní aplikace.
 * Používá se pro svatební dary – peníze jdou přímo na účet páru.
 */

/** Ověří IBAN kontrolním součtem mod 97. */
export function isValidIban(iban: string): boolean {
  const v = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  return mod97(numeric(v.slice(4) + v.slice(0, 4))) === 1;
}

function numeric(s: string): string {
  return s.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
}

function mod97(digits: string): number {
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest;
}

/** Vážený kontrolní součet čísla účtu podle ČNB. */
function validCzPart(part: string): boolean {
  const weights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
  const padded = part.padStart(10, "0");
  const sum = padded.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  return sum % 11 === 0;
}

/**
 * Převede české číslo účtu „předčíslí-číslo/kód banky“ na IBAN.
 * Vrací null, když číslo účtu není platné.
 */
export function czAccountToIban(account: string): string | null {
  const m = account.replace(/\s+/g, "").match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return null;
  const [, prefix = "0", number, bank] = m;
  if (!validCzPart(prefix) || !validCzPart(number)) return null;
  const bban = bank + prefix.padStart(6, "0") + number.padStart(10, "0");
  const check = 98 - mod97(numeric(`${bban}CZ00`));
  return `CZ${String(check).padStart(2, "0")}${bban}`;
}

/** Přijme číslo účtu i IBAN a vrátí IBAN, nebo null. */
export function toIban(input: string): string | null {
  const v = input.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{2}/.test(v)) return isValidIban(v) ? v : null;
  return czAccountToIban(input);
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Řetězec pro QR platbu. Částka je nepovinná (dar si host zvolí sám). */
export function spayd({ iban, amount, message, currency = "CZK" }: { iban: string; amount?: number; message?: string; currency?: string }): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\*/g, "")
      .slice(0, 60);
  const parts = ["SPD", "1.0", `ACC:${iban}`];
  if (amount && amount > 0) parts.push(`AM:${amount.toFixed(2)}`);
  parts.push(`CC:${currency}`);
  if (message) parts.push(`MSG:${clean(message)}`);
  return parts.join("*");
}
