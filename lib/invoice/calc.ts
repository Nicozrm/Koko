import type { Invoice, InvoiceLine, TaxMode, TaxRate } from "./types";

/**
 * Rechenkern. Ganzzahlig in Cent, kaufmännisch gerundet.
 *
 * Zwei Wege führen zum selben Blatt: Der Betrieb denkt in Ladenpreisen
 * (brutto), das Finanzamt in Netto plus Steuer. Beide Richtungen sind hier
 * abgebildet – gerundet wird pro Position, nicht erst in der Summe, damit die
 * ausgewiesenen Zeilen sich auch tatsächlich zur Endsumme addieren. Wer erst
 * am Ende rundet, produziert Rechnungen, die um einen Cent nicht aufgehen.
 */

/**
 * Kaufmännische Rundung (halbe Cent immer aufwärts, auch bei Negativbeträgen).
 *
 * Exportiert, weil die E-Rechnung dieselbe Rundung braucht: Weichen XML und
 * Blatt auch nur um einen Cent voneinander ab, ist die Rechnung nach EN 16931
 * ungültig – und zwar wortlos, weil das Blatt weiterhin richtig aussieht.
 */
export function round(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export interface LineTotals {
  /** Positionswert vor Rabatt, in der eingegebenen Preisart. */
  rawCents: number;
  discountCents: number;
  netCents: number;
  taxCents: number;
  grossCents: number;
  /** Tatsächlich angewandter Steuersatz (0 bei § 19 / § 25a). */
  effectiveRate: TaxRate;
}

/** § 19 und § 25a weisen keine Umsatzsteuer aus – der Satz fällt auf 0. */
export function effectiveRate(rate: TaxRate, mode: TaxMode): TaxRate {
  return mode === "regel" ? rate : 0;
}

/** Positionswert vor der Steuerrechnung, in der eingegebenen Preisart. */
interface RawLine {
  rate: TaxRate;
  rawCents: number;
  discountCents: number;
  /** Wert nach Rabatt – brutto oder netto, je nach `grossEntry`. */
  valueCents: number;
}

function rawLine(line: InvoiceLine, invoice: Invoice): RawLine {
  const rate = effectiveRate(line.taxRate, invoice.taxMode);
  const rawCents = round(line.qty * line.unitCents);
  const discountCents = round(rawCents * (line.discountPct / 100));
  return { rate, rawCents, discountCents, valueCents: rawCents - discountCents };
}

/**
 * Verteilt eine Summe nach der Methode der größten Reste.
 *
 * `exact` sind die ungerundeten Anteile, `total` die Summe, die exakt
 * herauskommen **muss**. Jeder Anteil wird abgerundet, der Rest geht an die
 * Positionen mit dem größten Nachkommateil. Damit stimmen Summe und
 * Einzelwerte auf den Cent – im Gegensatz zum naiven Runden jeder Position,
 * bei dem sich die Fehler aufaddieren.
 */
function largestRemainder(exact: number[], total: number): number[] {
  const floors = exact.map(Math.floor);
  const assigned = floors.reduce((s, v) => s + v, 0);
  let rest = total - assigned;

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    // Gleicher Nachkommateil: die frühere Position gewinnt, damit dieselbe
    // Rechnung immer dasselbe Ergebnis liefert.
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  for (const { i } of order) {
    if (rest <= 0) break;
    result[i] += 1;
    rest -= 1;
  }
  // Negativer Rest (bei Gutschriften) wandert von den kleinsten Resten zurück.
  for (let k = order.length - 1; k >= 0 && rest < 0; k--) {
    result[order[k].i] -= 1;
    rest += 1;
  }
  return result;
}

/**
 * Nettobetrag einer Steuergruppe aus ihrem Bruttobetrag.
 *
 * Nicht einfach `brutto / 1,19` gerundet: EN 16931 verlangt in BR-CO-17, dass
 * der Steuerbetrag sich aus der Bemessungsgrundlage ergibt
 * (`Steuer = runde(Netto × Satz)`). Nach naivem Abrunden gilt das nicht immer,
 * und dann steht auf dem Blatt eine Summe, die kein Prüfprogramm nachrechnen
 * kann. Deshalb werden drei Kandidaten geprüft und der genommen, der die
 * Bruttosumme **exakt** trifft – also die Summe der Ladenpreise erhält.
 *
 * Nur wenn keiner passt, gewinnt die Norm: Dann verschiebt sich der
 * Bruttobetrag um einen Cent.
 *
 * ## Wie oft das vorkommt, und wohin der Cent geht
 *
 * „Praktisch selten" stand hier lange und war zu freundlich: Bei 19 % sind
 * **16 % aller Bruttobeträge arithmetisch unerreichbar**. Es gibt für sie
 * schlicht kein ganzzahliges Netto. Der bekannteste Fall ist ausgerechnet
 * der, mit dem CLAUDE.md die Regel erklärt hat – 39,80 € liegt in einer
 * Lücke: 3344 Cent netto ergeben 39,79 €, 3345 Cent ergeben 39,81 €, und
 * dazwischen ist nichts.
 *
 * Die Richtung des Cents war bis dahin ein Rundungszufall: `start` ist der
 * gerundete Quotient, und der fällt mal darüber, mal darunter. Über alle
 * Lücken bei 19 % gerechnet ging er in 8404 Fällen nach oben und in 7562
 * nach unten – der Kunde zahlte also in etwas mehr als der Hälfte der
 * Lückenfälle **einen Cent mehr, als ausgezeichnet war**.
 *
 * Das ist die eine Richtung, die eine Werkstatt nicht wählen sollte. Ein
 * ausgezeichneter Preis ist eine Zusage; ihn zu unterschreiten ist
 * folgenlos, ihn zu überschreiten nicht. Deshalb wird jetzt bewusst der
 * größte Nettowert genommen, dessen Bruttobetrag den eingegebenen **nicht
 * übersteigt**. Aus 2 × 19,90 € werden damit 39,79 € – ein Cent zugunsten
 * des Kunden, jedes Mal und nachvollziehbar, statt einer Münze.
 *
 * An BR-CO-17 ändert das nichts: Die Steuer folgt weiterhin aus der
 * Bemessungsgrundlage, gleich welches Netto gewählt wird.
 */
function netFromGross(grossCents: number, rate: TaxRate): number {
  if (rate === 0) return grossCents;
  const brutto = (net: number) => net + round((net * rate) / 100);
  const start = round(grossCents / (1 + rate / 100));

  // Erste Wahl: ein Netto, das die Summe exakt reproduziert.
  for (const candidate of [start, start - 1, start + 1]) {
    if (brutto(candidate) === grossCents) return candidate;
  }

  /*
    Sonst der nächstgelegene Wert, der den eingegebenen Betrag dem Betrag
    nach nicht überschreitet. Von oben nach unten gesucht, damit der
    kleinstmögliche Abstand gewinnt; bei Gutschriften (negative Beträge)
    kehrt sich „nicht überschreiten" mit dem Vorzeichen um.
  */
  const zuVielt = grossCents < 0
    ? (wert: number) => wert < grossCents
    : (wert: number) => wert > grossCents;

  for (const candidate of [start + 1, start, start - 1, start - 2]) {
    if (!zuVielt(brutto(candidate))) return candidate;
  }
  return start;
}

export function lineTotals(line: InvoiceLine, invoice: Invoice): LineTotals {
  const r = rawLine(line, invoice);
  const netCents = invoice.grossEntry
    ? netFromGross(r.valueCents, r.rate)
    : r.valueCents;
  const taxCents = round((netCents * r.rate) / 100);

  return {
    rawCents: r.rawCents,
    discountCents: r.discountCents,
    netCents,
    taxCents,
    grossCents: netCents + taxCents,
    effectiveRate: r.rate,
  };
}

export interface TaxGroup {
  rate: TaxRate;
  netCents: number;
  taxCents: number;
  grossCents: number;
}

export interface InvoiceTotals {
  lines: (LineTotals & { id: string })[];
  /** Aufschlüsselung nach Steuersätzen – § 14 Abs. 4 Nr. 8 UStG. */
  groups: TaxGroup[];
  netCents: number;
  taxCents: number;
  grossCents: number;
  discountCents: number;
  /** Fälligkeitsdatum als ISO-String, aus Datum + Zahlungsziel. */
  dueDate: string;
}

/**
 * Summen der Rechnung – gruppenweise gerechnet, nicht positionsweise.
 *
 * Der Unterschied ist kein Feinschliff. Wer je Position rundet und die
 * Ergebnisse addiert, bekommt regelmäßig einen Cent mehr oder weniger heraus
 * als die Norm vorschreibt: EN 16931 leitet den Steuerbetrag aus der
 * **Bemessungsgrundlage der Steuergruppe** ab (BR-CO-17), nicht aus der Summe
 * gerundeter Einzelsteuern. Bei drei Positionen zu 19 % lagen beide Wege in
 * unserem Test 0,01 € auseinander – genug, dass ein Empfänger die E-Rechnung
 * automatisch zurückweist, während das gedruckte Blatt weiterhin plausibel
 * aussieht.
 *
 * Deshalb: erst gruppieren, dann je Gruppe rechnen, dann die Gruppensumme mit
 * größten Resten auf die Positionen zurückverteilen. So stimmen Positionen,
 * Gruppen und Endsumme zugleich – und Blatt und XML sagen dasselbe.
 */
export function invoiceTotals(invoice: Invoice): InvoiceTotals {
  const raws = invoice.lines.map((l) => rawLine(l, invoice));

  const netCents = new Array<number>(raws.length).fill(0);
  const taxCents = new Array<number>(raws.length).fill(0);
  const groups: TaxGroup[] = [];

  // Reihenfolge der Sätze festhalten, damit die Ausgabe stabil bleibt.
  const rates = [...new Set(raws.map((r) => r.rate))].sort((a, b) => b - a);

  for (const rate of rates) {
    const idx = raws.map((r, i) => (r.rate === rate ? i : -1)).filter((i) => i >= 0);
    const values = idx.map((i) => raws[i].valueCents);
    const factor = 1 + rate / 100;

    /*
      Grundsatz: Der eingegebene Wert bleibt unangetastet, verteilt wird nur
      der abgeleitete.

      Wer im Laden 19,90 € auszeichnet und zwei Stück verkauft, muss auf der
      Rechnung 39,80 € lesen – nicht 39,79 €, weil ein Rundungsrest so fiel.
      Also steht bei Bruttoeingabe der Bruttobetrag jeder Position fest, und
      die Nettobeträge werden mit größten Resten so verteilt, dass ihre Summe
      die Bemessungsgrundlage der Gruppe trifft. Bei Nettoeingabe umgekehrt.
    */
    let groupNet: number;
    let groupTax: number;

    if (invoice.grossEntry) {
      const groupGross = values.reduce((s, v) => s + v, 0);
      groupNet = netFromGross(groupGross, rate);
      groupTax = round((groupNet * rate) / 100);

      const nets = largestRemainder(
        values.map((v) => v / factor),
        groupNet,
      );
      idx.forEach((i, k) => {
        netCents[i] = nets[k];
        // Steuer als Differenz zum festen Bruttobetrag – nicht separat
        // gerundet. Nur so bleibt Netto + Steuer exakt der Ladenpreis.
        taxCents[i] = values[k] - nets[k];
      });

      // Findet `netFromGross` keinen passenden Nettowert, gewinnt die Norm und
      // die Gruppensumme verschiebt sich um einen Cent. Der geht auf die
      // größte Position, damit die Positionen weiter zur Summe passen.
      const drift = groupGross - (groupNet + groupTax);
      if (drift !== 0) {
        const biggest = idx.reduce((a, b) => (values[idx.indexOf(a)] >= values[idx.indexOf(b)] ? a : b));
        taxCents[biggest] -= drift;
      }
    } else {
      idx.forEach((i, k) => (netCents[i] = values[k]));
      groupNet = values.reduce((s, v) => s + v, 0);
      groupTax = round((groupNet * rate) / 100);

      const taxes = largestRemainder(
        values.map((v) => (v * rate) / 100),
        groupTax,
      );
      idx.forEach((i, k) => (taxCents[i] = taxes[k]));
    }

    groups.push({
      rate,
      netCents: groupNet,
      taxCents: groupTax,
      grossCents: groupNet + groupTax,
    });
  }

  const lines = invoice.lines.map((l, i) => ({
    id: l.id,
    rawCents: raws[i].rawCents,
    discountCents: raws[i].discountCents,
    netCents: netCents[i],
    taxCents: taxCents[i],
    grossCents: netCents[i] + taxCents[i],
    effectiveRate: raws[i].rate,
  }));

  return {
    lines,
    groups,
    netCents: groups.reduce((s, g) => s + g.netCents, 0),
    taxCents: groups.reduce((s, g) => s + g.taxCents, 0),
    grossCents: groups.reduce((s, g) => s + g.grossCents, 0),
    discountCents: lines.reduce((s, l) => s + l.discountCents, 0),
    dueDate: addDays(invoice.date, invoice.dueDays),
  };
}

/* ---- Formatierung -------------------------------------------------------- */

const euroFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cent → „1.234,56 €“. */
export function cents(value: number): string {
  return euroFmt.format(value / 100);
}

/** Cent → „1234.56“ (Maschinenformat für QR-Code und Export). */
export function centsPlain(value: number): string {
  return (value / 100).toFixed(2);
}

/** Eingabefeld-Format ohne Währungszeichen. */
export function centsInput(value: number): string {
  return numFmt.format(value / 100);
}

/** „129,90“ oder „129.90“ → 12990. Leere Eingabe ergibt 0. */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const normalised = cleaned.replace(",", ".");
  const value = Number.parseFloat(normalised);
  return Number.isFinite(value) ? round(value * 100) : 0;
}

/** „1,5“ → 1.5. Mengen unter 0 sind nicht zulässig. */
export function parseQty(input: string): number {
  const value = Number.parseFloat(input.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

/* ---- Datum --------------------------------------------------------------- */

export function today(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** ISO → „01.08.2026“. */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
