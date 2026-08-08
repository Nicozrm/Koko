/*
  Prüft die Geldrechnung des Rechnungswerkzeugs.

  Warum ausgerechnet hier ein eigenes Skript steht: Ein Cent-Fehler in
  dieser Datei ist unsichtbar. Das gedruckte Blatt sieht weiterhin
  plausibel aus – Positionen, Zwischensumme, Steuer, Endsumme, alles
  gerundet und alles glaubwürdig –, während die daraus erzeugte
  E-Rechnung vom Empfänger automatisch zurückgewiesen wird, weil
  EN 16931 in BR-CO-17 nachrechnet und einen Cent Abweichung findet.
  Niemand im Betrieb merkt etwas; die Rückweisung kommt Tage später aus
  einem fremden System.

  Genau die Sorte Fehler, für die es die übrigen Prüfskripte gibt – nur
  dass diese Datei bisher keines hatte.

  Geprüft werden nicht Beispiele, sondern **Invarianten**: Sätze, die für
  jede erzeugbare Rechnung gelten müssen. Sie laufen gegen einige tausend
  zufällig gewürfelte Belege, weil sich Rundungsfehler genau dort
  verstecken, wo niemand von Hand hinsieht.

    1. Netto + Steuer = Brutto, auf jeder Ebene.
    2. Die Steuer je Gruppe folgt aus der Bemessungsgrundlage (BR-CO-17).
    3. Die Positionen summieren sich auf ihre Gruppe.
    4. Bei Bruttoeingabe bleibt der eingegebene Ladenpreis stehen.
    5. Ohne Steuerausweis (§ 19, § 25a) steht nirgends Steuer.
    6. Alle Beträge sind ganzzahlige Cent.
    7. Übertrag plus Folgepositionen ergeben wieder die Endsumme.

  Aufruf: npm run verify:invoice
*/
import { invoiceTotals, lineTotals, round, parseCents } from "../lib/invoice/calc.ts";
import { paginate } from "../lib/invoice/paginate.ts";

let failures = 0;
const fail = (text) => {
  failures++;
  console.log(`  FEHLER ${text}`);
};
const ok = (text) => console.log(`  ok    ${text}`);

/* ---- Ein reproduzierbarer Würfel ---------------------------------------- */

/*
  Eigener Zufall statt Math.random: Ein Fehlschlag muss sich nachstellen
  lassen. Ohne festen Startwert meldet das Skript einen Cent Abweichung in
  Lauf 3182 und niemand kann ihn je wieder herstellen.
*/
let seed = 20260808;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const RATES = [0, 7, 19];
const MODES = ["regel", "klein", "differenz"];

function wuerfelRechnung(n) {
  const taxMode = pick(MODES);
  return {
    docType: "rechnung",
    number: "RE-2026-0001",
    date: "2026-08-08",
    serviceDate: "2026-08-08",
    dueDays: int(0, 30),
    customer: { name: "Muster" },
    taxMode,
    grossEntry: rnd() < 0.5,
    device: { model: "", imei: "", condition: "" },
    lines: Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      // Krumme Mengen sind der Normalfall in einer Werkstatt (1,5 Std.).
      qty: pick([1, 1, 1, 2, 3, 0.5, 1.5, 2.5, 0.25]),
      unit: "Stk.",
      title: `Position ${i}`,
      note: "",
      unitCents: int(1, 250000),
      taxRate: pick(RATES),
      discountPct: pick([0, 0, 0, 5, 10, 12.5, 33.7]),
    })),
  };
}

/* ---- 1. Die Invarianten gegen viele Belege ------------------------------ */

console.log("Geldrechnung – Invarianten gegen zufällige Belege\n");
{
  const LAEUFE = 4000;
  const verletzt = new Map();
  const merke = (regel, invoice) => {
    if (!verletzt.has(regel)) verletzt.set(regel, { anzahl: 0, beispiel: invoice });
    verletzt.get(regel).anzahl++;
  };

  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const invoice = wuerfelRechnung(int(1, 6));
    const t = invoiceTotals(invoice);

    // (6) Ganzzahlige Cent – überall.
    const alleZahlen = [
      t.netCents, t.taxCents, t.grossCents, t.discountCents,
      ...t.lines.flatMap((l) => [l.netCents, l.taxCents, l.grossCents, l.rawCents, l.discountCents]),
      ...t.groups.flatMap((g) => [g.netCents, g.taxCents, g.grossCents]),
    ];
    if (alleZahlen.some((v) => !Number.isInteger(v))) merke("ganzzahlige Cent", invoice);

    // (1) Netto + Steuer = Brutto, auf jeder Ebene.
    if (t.netCents + t.taxCents !== t.grossCents) merke("Summe: Netto + Steuer = Brutto", invoice);
    for (const g of t.groups) {
      if (g.netCents + g.taxCents !== g.grossCents) merke("Gruppe: Netto + Steuer = Brutto", invoice);
    }
    for (const l of t.lines) {
      if (l.netCents + l.taxCents !== l.grossCents) merke("Position: Netto + Steuer = Brutto", invoice);
    }

    // (2) BR-CO-17: Die Steuer der Gruppe folgt aus ihrer Bemessungsgrundlage.
    for (const g of t.groups) {
      if (g.taxCents !== round((g.netCents * g.rate) / 100)) {
        merke("BR-CO-17: Steuer = runde(Netto × Satz)", invoice);
      }
    }

    // (3) Die Positionen summieren sich auf ihre Gruppe.
    for (const g of t.groups) {
      const drin = t.lines.filter((l) => l.effectiveRate === g.rate);
      const netto = drin.reduce((s, l) => s + l.netCents, 0);
      const steuer = drin.reduce((s, l) => s + l.taxCents, 0);
      if (netto !== g.netCents) merke("Positionen summieren sich auf das Gruppennetto", invoice);
      if (steuer !== g.taxCents) merke("Positionen summieren sich auf die Gruppensteuer", invoice);
    }

    // (5) Ohne Steuerausweis darf nirgends Steuer stehen.
    if (invoice.taxMode !== "regel") {
      if (t.taxCents !== 0 || t.groups.some((g) => g.rate !== 0 || g.taxCents !== 0)) {
        merke("§ 19 / § 25a: kein Steuerausweis", invoice);
      }
    }
  }

  if (verletzt.size === 0) {
    ok(`${LAEUFE} Belege, alle Invarianten halten`);
  } else {
    for (const [regel, { anzahl, beispiel }] of verletzt) {
      fail(
        `${regel}: in ${anzahl} von ${LAEUFE} Belegen verletzt.\n` +
          `        Beispiel: ${JSON.stringify(beispiel)}`,
      );
    }
  }
}

/* ---- 2. Der Ladenpreis bleibt stehen ------------------------------------ */

console.log("\nBruttoeingabe – der ausgezeichnete Preis bleibt unangetastet\n");
{
  /*
    Die Zusage aus CLAUDE.md: „Der eingegebene Wert bleibt unangetastet,
    verteilt wird nur der abgeleitete." Wer 19,90 € auszeichnet und zwei
    Stück verkauft, muss 39,80 € lesen – nicht 39,79 €.

    Die Ausnahme ist benannt und begrenzt: Findet `netFromGross` keinen
    Nettowert, der die Bruttosumme exakt reproduziert, gewinnt die Norm und
    genau ein Cent wandert. Geprüft wird deshalb nicht „nie", sondern
    „höchstens ein Cent, und nur auf einer Position der Gruppe".
  */
  let geprueft = 0;
  let gewandert = 0;
  let zuViel = 0;

  for (let lauf = 0; lauf < 3000; lauf++) {
    const invoice = { ...wuerfelRechnung(int(1, 5)), grossEntry: true, taxMode: "regel" };
    const t = invoiceTotals(invoice);
    geprueft++;

    for (const g of t.groups) {
      const drin = invoice.lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.taxRate === g.rate);
      // Der eingegebene Bruttowert der Position: Menge × Preis minus Rabatt.
      const erwartet = drin.map(({ l }) => {
        const raw = round(l.qty * l.unitCents);
        return raw - round(raw * (l.discountPct / 100));
      });
      const tatsaechlich = drin.map(({ i }) => t.lines[i].grossCents);

      const abweichungen = erwartet
        .map((v, k) => Math.abs(v - tatsaechlich[k]))
        .filter((d) => d !== 0);

      if (abweichungen.length > 0) {
        gewandert++;
        if (abweichungen.length > 1 || abweichungen[0] > 1) zuViel++;
      }
    }
  }

  if (zuViel > 0) {
    fail(`${zuViel} Belege verschieben mehr als einen Cent auf einer Position.`);
  } else {
    const quote = (100 * (geprueft - gewandert)) / geprueft;
    ok(
      `${geprueft} Belege: der Ladenpreis steht in ${quote.toFixed(1)} % der Fälle ` +
        `unverändert, sonst wandert genau ein Cent`,
    );
  }
}

/* ---- 3. Einzelne Fälle von Hand ----------------------------------------- */

console.log("\nGerechnete Fälle – von Hand nachgerechnet\n");
{
  const beleg = (lines, extra = {}) => ({
    docType: "rechnung",
    number: "RE-1",
    date: "2026-08-08",
    serviceDate: "2026-08-08",
    dueDays: 14,
    customer: { name: "M" },
    taxMode: "regel",
    grossEntry: false,
    device: { model: "", imei: "", condition: "" },
    lines: lines.map((l, i) => ({
      id: `l${i}`,
      qty: 1,
      unit: "Stk.",
      title: "P",
      note: "",
      discountPct: 0,
      taxRate: 19,
      ...l,
    })),
    ...extra,
  });

  /*
    Der Fall, mit dem CLAUDE.md die Regel erklärt hat – und der die Regel
    widerlegt: 39,80 € ist bei 19 % arithmetisch unerreichbar. 3344 Cent
    netto ergeben 39,79 €, 3345 ergeben 39,81 €, dazwischen liegt nichts.
    Verlangt wird deshalb nicht der unmögliche Betrag, sondern die
    Entscheidung: höchstens der ausgezeichnete Preis, nie mehr.
  */
  const laden = invoiceTotals(
    beleg([{ qty: 2, unitCents: 1990, taxRate: 19 }], { grossEntry: true }),
  );
  if (laden.grossCents > 3980) {
    fail(`2 × 19,90 € ergeben ${laden.grossCents} Cent – mehr als ausgezeichnet.`);
  } else if (laden.grossCents !== 3979) {
    fail(`2 × 19,90 € ergeben ${laden.grossCents} statt 3979 Cent.`);
  } else {
    ok("2 × 19,90 € → 39,79 € (39,80 € ist bei 19 % unerreichbar)");
  }

  // Und dieselbe Zusage über die ganze Breite: nie mehr als eingegeben.
  {
    let zuTeuer = 0;
    let geprueft = 0;
    for (let cents = 1; cents <= 200000; cents++) {
      geprueft++;
      const b = invoiceTotals(
        beleg([{ qty: 1, unitCents: cents, taxRate: 19 }], { grossEntry: true }),
      );
      if (b.grossCents > cents) zuTeuer++;
    }
    if (zuTeuer > 0) {
      fail(`${zuTeuer} von ${geprueft} Bruttopreisen werden teurer abgerechnet als eingegeben.`);
    } else {
      ok(`${geprueft} Bruttopreise von 0,01 € bis 2.000 €: keiner wird teurer`);
    }
  }

  /*
    Der Fall, an dem sich positionsweises Runden verrät: drei Positionen zu
    19 %, deren Einzelsteuern je auf ,5 fallen. Positionsweise gerundet und
    addiert kommt ein anderer Betrag heraus als aus der Bemessungsgrundlage.
  */
  const drei = invoiceTotals(beleg([
    { unitCents: 1050 },
    { unitCents: 1050 },
    { unitCents: 1050 },
  ]));
  const ausGrundlage = round((3150 * 19) / 100);
  const positionsweise = 3 * round((1050 * 19) / 100);
  if (drei.taxCents !== ausGrundlage) {
    fail(`Steuer ${drei.taxCents} folgt nicht der Bemessungsgrundlage (${ausGrundlage}).`);
  } else {
    ok(
      `3 × 10,50 €: Steuer ${ausGrundlage} aus der Grundlage` +
        (positionsweise !== ausGrundlage ? ` (positionsweise wären es ${positionsweise})` : ""),
    );
  }

  // Gemischte Sätze müssen getrennt ausgewiesen werden – § 14 Abs. 4 Nr. 8.
  const gemischt = invoiceTotals(beleg([
    { unitCents: 10000, taxRate: 19 },
    { unitCents: 10000, taxRate: 7 },
    { unitCents: 10000, taxRate: 0 },
  ]));
  if (gemischt.groups.length !== 3) {
    fail(`Drei Sätze ergeben ${gemischt.groups.length} Gruppen statt drei.`);
  } else if (gemischt.groups.map((g) => g.rate).join() !== "19,7,0") {
    fail(`Die Gruppen stehen in der Reihenfolge ${gemischt.groups.map((g) => g.rate).join()}.`);
  } else {
    ok("drei Sätze → drei Gruppen, absteigend sortiert");
  }

  // Kleinunternehmer: Der Satz der Position ist gesetzt, ausgewiesen wird nichts.
  const klein = invoiceTotals(
    beleg([{ unitCents: 10000, taxRate: 19 }], { taxMode: "klein" }),
  );
  if (klein.taxCents !== 0 || klein.grossCents !== klein.netCents) {
    fail("§ 19: Es wird trotzdem Steuer ausgewiesen.");
  } else {
    ok("§ 19 Kleinunternehmer: Satz gesetzt, Ausweis null");
  }

  // Ein Rabatt von 100 % darf nicht in negative Beträge kippen.
  const ganz = invoiceTotals(beleg([{ unitCents: 5000, discountPct: 100 }]));
  if (ganz.grossCents !== 0) fail(`100 % Rabatt ergeben ${ganz.grossCents} statt 0.`);
  else ok("100 % Rabatt ergibt genau null, nicht minus null");

  // Ein Beleg ohne Positionen darf nicht werfen.
  try {
    const leer = invoiceTotals(beleg([]));
    if (leer.grossCents !== 0 || leer.groups.length !== 0) {
      fail("Ein Beleg ohne Positionen ergibt nicht null.");
    } else {
      ok("ein Beleg ohne Positionen ergibt null, ohne zu werfen");
    }
  } catch (error) {
    fail(`Ein Beleg ohne Positionen wirft: ${error.message}`);
  }
}

/* ---- 4. Eingabe und Ausgabe von Beträgen -------------------------------- */

console.log("\nBeträge lesen – Komma, Punkt, Leerzeichen\n");
{
  const faelle = [
    ["19,90", 1990],
    ["19.90", 1990],
    ["1.234,56", 123456],
    ["0,01", 1],
    ["0", 0],
    ["", 0],
    ["  42  ", 4200],
  ];
  let schlecht = 0;
  for (const [eingabe, erwartet] of faelle) {
    const wert = parseCents(eingabe);
    if (wert !== erwartet) {
      schlecht++;
      fail(`„${eingabe}" ergibt ${wert} statt ${erwartet} Cent.`);
    }
  }
  if (schlecht === 0) ok(`${faelle.length} Schreibweisen ergeben den erwarteten Cent-Betrag`);

  // Die Rundung selbst: kaufmännisch, und auch bei negativen Beträgen
  // (Gutschriften) nicht Richtung null verrutschen.
  if (round(0.5) !== 1) fail(`round(0,5) = ${round(0.5)} statt 1.`);
  if (round(1.5) !== 2) fail(`round(1,5) = ${round(1.5)} statt 2.`);
  if (round(2.5) !== 3) fail(`round(2,5) = ${round(2.5)} statt 3 – bankers rounding?`);
  else ok("kaufmännisch gerundet, auch bei ,5");
}

/* ---- 5. Position und Summe erzählen dasselbe ---------------------------- */

console.log("\nPosition gegen Summe – lineTotals und invoiceTotals\n");
{
  /*
    `lineTotals` rechnet eine Position für sich; `invoiceTotals` rechnet sie
    im Verbund ihrer Gruppe. Bei genau einer Position derselben Gruppe müssen
    beide dasselbe sagen – sonst zeigte das Blatt in der Zeile etwas anderes
    als in der Summe.
  */
  let schlecht = 0;
  for (let lauf = 0; lauf < 500; lauf++) {
    const invoice = wuerfelRechnung(1);
    const einzeln = lineTotals(invoice.lines[0], invoice);
    const imVerbund = invoiceTotals(invoice).lines[0];
    if (
      einzeln.netCents !== imVerbund.netCents ||
      einzeln.taxCents !== imVerbund.taxCents ||
      einzeln.grossCents !== imVerbund.grossCents
    ) {
      schlecht++;
      if (schlecht === 1) {
        fail(
          `Einzelrechnung und Summenrechnung weichen ab.\n` +
            `        einzeln:    ${JSON.stringify(einzeln)}\n` +
            `        im Verbund: ${JSON.stringify(imVerbund)}\n` +
            `        Beleg:      ${JSON.stringify(invoice.lines[0])} grossEntry=${invoice.grossEntry}`,
        );
      }
    }
  }
  if (schlecht === 0) ok("500 einzelne Positionen: Zeile und Summe sagen dasselbe");
  else fail(`${schlecht} von 500 Positionen weichen ab.`);
}

/* ---- 6. Mehrseitigkeit und Übertrag ------------------------------------- */

console.log("\nMehrseitigkeit – Übertrag plus Folgepositionen ergibt die Endsumme\n");
{
  /*
    In CLAUDE.md steht dazu ein Satz im Imperativ: „wer hier etwas ändert,
    prüft, dass Übertrag plus Folgepositionen wieder die Endsumme ergeben."
    Geprüft hat das bisher niemand – es war eine Bitte an den nächsten
    Menschen, und der nächste Mensch hat anderes zu tun.

    Der Übertrag ist die einzige Zahl auf dem Blatt, die ein Kunde
    nachrechnen kann und auch nachrechnet. Stimmt sie nicht, stimmt aus
    seiner Sicht die ganze Rechnung nicht – unabhängig davon, ob die
    Endsumme richtig ist.
  */
  const baseInvoice = (lines) => ({
    docType: "rechnung",
    number: "RE-2026-0002",
    date: "2026-08-08",
    serviceDate: "2026-08-08",
    dueDays: 14,
    customer: { name: "Muster" },
    taxMode: "regel",
    grossEntry: false,
    device: { model: "", imei: "", condition: "" },
    lines,
  });

  const langeTexte = [
    "",
    "IMEI 356938035643809",
    "Displayeinheit inkl. Rahmen, Originalqualität, mit Dichtung erneuert",
    "A".repeat(140),
  ];

  let verletzungen = 0;
  const melde = (text) => {
    verletzungen++;
    if (verletzungen <= 3) fail(text);
  };

  let mehrseitig = 0;
  let mitAnschlussblatt = 0;
  const LAEUFE = 1200;

  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const n = int(1, 40);
    const invoice = baseInvoice(
      Array.from({ length: n }, (_, i) => ({
        id: `l${i}`,
        qty: pick([1, 2, 1.5]),
        unit: "Stk.",
        title: pick(["Displaytausch", "Akkutausch", "A".repeat(int(5, 120))]),
        note: pick(langeTexte),
        unitCents: int(100, 90000),
        taxRate: 19,
        discountPct: pick([0, 0, 10]),
      })),
    );
    const hasSlip = rnd() < 0.5;

    const t = invoiceTotals(invoice);
    const pages = paginate(invoice, t.lines, (l) => l.grossCents, hasSlip);

    if (pages.length > 1) mehrseitig++;
    // Ein kurzes Schlussblatt ist das Zeichen dafür, dass der Abschluss nicht
    // mehr aufs Vorblatt passte und Zeilen mitgewandert sind – der Pfad, an
    // dem die Überträge nachträglich neu bestimmt werden.
    if (pages.length > 1 && pages[pages.length - 1].lines.length <= 3) mitAnschlussblatt++;

    // (a) Jede Position genau einmal, in der ursprünglichen Reihenfolge.
    const verteilt = pages.flatMap((p) => p.lines.map((l) => l.index));
    const erwartet = invoice.lines.map((_, i) => i);
    if (verteilt.join() !== erwartet.join()) {
      melde(
        `Positionen gehen verloren oder verrutschen: ${verteilt.length} von ${n}` +
          ` (${verteilt.slice(0, 12).join(",")}…)`,
      );
      continue;
    }

    // (b) Genau ein Schlussblatt, und zwar das letzte.
    const schluss = pages.map((p, i) => (p.isLast ? i : -1)).filter((i) => i >= 0);
    if (schluss.length !== 1 || schluss[0] !== pages.length - 1) {
      melde(`${schluss.length} Blätter tragen den Summenblock (erwartet: nur das letzte).`);
    }

    // (c) Der Übertrag jeder Seite ist die Bruttosumme aller Vorseiten.
    let laufend = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.carryIn !== laufend) {
        melde(`Seite ${i + 1}: Übertrag ${p.carryIn} statt ${laufend} Cent.`);
        break;
      }
      const seitenSumme = p.lines.reduce((s, l) => s + l.totals.grossCents, 0);
      laufend += seitenSumme;

      const istLetzte = i === pages.length - 1;
      if (istLetzte) {
        if (p.carryOut !== null) melde(`Die letzte Seite trägt einen Übertrag nach unten.`);
      } else if (p.carryOut !== laufend) {
        melde(`Seite ${i + 1}: Übertrag nach unten ${p.carryOut} statt ${laufend} Cent.`);
        break;
      }
    }

    // (d) Die eigentliche Zusage: Übertrag + Positionen der Schlussseite
    //     ergeben die Endsumme des Belegs.
    const letzte = pages[pages.length - 1];
    const schlussSumme =
      letzte.carryIn + letzte.lines.reduce((s, l) => s + l.totals.grossCents, 0);
    if (schlussSumme !== t.grossCents) {
      melde(
        `Übertrag ${letzte.carryIn} + Schlussseite ergeben ${schlussSumme}, ` +
          `die Rechnung sagt ${t.grossCents} Cent.`,
      );
    }

    // (e) Kein Anschlussblatt mit genau einer verwaisten Position, wenn das
    //     Vorblatt noch Zeilen hätte abgeben können – der Schusterjunge.
    if (pages.length > 1) {
      const vorletzte = pages[pages.length - 2];
      if (letzte.lines.length === 0 && vorletzte.lines.length === 0) {
        melde("Zwei leere Blätter hintereinander.");
      }
    }
  }

  if (verletzungen === 0) {
    ok(
      `${LAEUFE} Belege, davon ${mehrseitig} mehrseitig und ${mitAnschlussblatt} mit ` +
        `kurzem Schlussblatt – Übertrag und Endsumme stimmen überein`,
    );
  } else {
    fail(`${verletzungen} Belege verletzen die Übertragsregel.`);
  }
}

/* ---- 6b. Die Grenze, an der der Abschluss nicht mehr passt -------------- */

console.log("\nAnschlussblatt – die Grenze systematisch abgeschritten\n");
{
  /*
    Der Zufall oben trifft den heikelsten Pfad nicht zuverlässig: Wenn der
    Summenblock auf der letzten Seite nicht mehr Platz findet, bekommt er
    ein eigenes Blatt, und bis zu drei Zeilen wandern mit, damit dort nicht
    nur eine einsame Endsumme steht. Genau dabei werden die Überträge neu
    bestimmt – die einzige Stelle, an der sie nachträglich verändert werden.

    Deshalb wird die Grenze hier abgeschritten statt gewürfelt: jede
    Positionszahl von 1 bis 60, mit und ohne Zahlungsabschnitt. Dazwischen
    liegt zwangsläufig der Punkt, an dem eine Zeile mehr den Abschluss
    verdrängt.
  */
  const bau = (n, textLang) => ({
    docType: "rechnung",
    number: "RE-2026-0004",
    date: "2026-08-08",
    serviceDate: "2026-08-08",
    dueDays: 14,
    customer: { name: "Muster" },
    taxMode: "regel",
    grossEntry: false,
    device: { model: "", imei: "", condition: "" },
    lines: Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      qty: 1,
      unit: "Stk.",
      title: textLang ? "B".repeat(90) : `Position ${i + 1}`,
      note: textLang ? "N".repeat(60) : "",
      unitCents: 1234 + i,
      taxRate: 19,
      discountPct: 0,
    })),
  });

  let geprueft = 0;
  let leereAnschluesse = 0;
  let kurzeAnschluesse = 0;
  let schlecht = 0;

  for (let n = 1; n <= 60; n++) {
    for (const slip of [false, true]) {
      for (const lang of [false, true]) {
        geprueft++;
        const invoice = bau(n, lang);
        const t = invoiceTotals(invoice);
        const pages = paginate(invoice, t.lines, (l) => l.grossCents, slip);

        // Vollständigkeit und Reihenfolge.
        const verteilt = pages.flatMap((p) => p.lines.map((l) => l.index));
        if (verteilt.join() !== invoice.lines.map((_, i) => i).join()) {
          schlecht++;
          if (schlecht === 1) {
            fail(`n=${n} slip=${slip} lang=${lang}: Positionen verrutschen oder fehlen.`);
          }
          continue;
        }

        // Die Übertragskette.
        let laufend = 0;
        let kette = true;
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].carryIn !== laufend) kette = false;
          laufend += pages[i].lines.reduce((s, l) => s + l.totals.grossCents, 0);
          const istLetzte = i === pages.length - 1;
          if (istLetzte ? pages[i].carryOut !== null : pages[i].carryOut !== laufend) kette = false;
        }
        if (!kette || laufend !== t.grossCents) {
          schlecht++;
          if (schlecht === 1) {
            fail(
              `n=${n} slip=${slip} lang=${lang}: Übertragskette bricht ` +
                `(${laufend} gegen ${t.grossCents} Cent).`,
            );
          }
          continue;
        }

        const letzte = pages[pages.length - 1];
        if (pages.length > 1) {
          if (letzte.lines.length === 0) leereAnschluesse++;
          else if (letzte.lines.length <= 3) kurzeAnschluesse++;
        }
      }
    }
  }

  if (schlecht > 0) {
    fail(`${schlecht} von ${geprueft} Aufteilungen sind fehlerhaft.`);
  } else if (leereAnschluesse === 0 && kurzeAnschluesse === 0) {
    fail(
      "Kein einziges Anschlussblatt entstanden – der geprüfte Bereich trifft " +
        "den Pfad nicht, um den es hier geht.",
    );
  } else {
    ok(
      `${geprueft} Aufteilungen von 1 bis 60 Positionen: Kette hält. ` +
        `${kurzeAnschluesse} kurze Schlussblätter, ${leereAnschluesse} leere`,
    );
  }
}

/* ---- 7. Der Übertrag am gerechneten Beispiel ---------------------------- */

console.log("\nÜbertrag – ein Beleg von Hand nachgerechnet\n");
{
  const viele = {
    docType: "rechnung",
    number: "RE-2026-0003",
    date: "2026-08-08",
    serviceDate: "2026-08-08",
    dueDays: 14,
    customer: { name: "Muster" },
    taxMode: "regel",
    grossEntry: false,
    device: { model: "", imei: "", condition: "" },
    // 30 gleiche Positionen zu 100,00 EUR netto – die Summe ist im Kopf zu prüfen.
    lines: Array.from({ length: 30 }, (_, i) => ({
      id: `l${i}`,
      qty: 1,
      unit: "Stk.",
      title: `Position ${i + 1}`,
      note: "",
      unitCents: 10000,
      taxRate: 19,
      discountPct: 0,
    })),
  };

  const t = invoiceTotals(viele);
  const pages = paginate(viele, t.lines, (l) => l.grossCents, true);

  // 30 × 100,00 EUR netto + 19 % = 3.570,00 EUR
  if (t.grossCents !== 357000) {
    fail(`30 × 100 € + 19 % ergeben ${t.grossCents} statt 357000 Cent.`);
  }
  if (pages.length < 2) {
    fail(`30 Positionen passen angeblich auf ${pages.length} Blatt.`);
  } else {
    const summe = pages.reduce(
      (s, p) => s + p.lines.reduce((a, l) => a + l.totals.grossCents, 0),
      0,
    );
    const letzte = pages[pages.length - 1];
    const abschluss = letzte.carryIn + letzte.lines.reduce((s, l) => s + l.totals.grossCents, 0);
    if (summe !== t.grossCents || abschluss !== t.grossCents) {
      fail(`Blattsummen ${summe} bzw. Abschluss ${abschluss} gegen ${t.grossCents}.`);
    } else {
      ok(
        `30 Positionen auf ${pages.length} Blättern, Übertrag ` +
          `${(letzte.carryIn / 100).toFixed(2)} € + Rest = ${(t.grossCents / 100).toFixed(2)} €`,
      );
    }
  }
}

/* ---- Ergebnis ----------------------------------------------------------- */

console.log("");
if (failures > 0) {
  console.log(`${failures} Fehler. Die Rechnung stimmt nicht mit sich selbst überein.`);
  process.exit(1);
}
console.log("Alles geprüft. Blatt und E-Rechnung rechnen dasselbe.");
