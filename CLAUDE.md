# CLAUDE.md

Anleitung für Claude Code beim Arbeiten in diesem Repository.

## Projekt

**Dr Smartphone48** (Greven) – Premium-Website für Smartphone-Reparatur,
Refurbished-Geräte und Ersatzteile. Das Design-Briefing steht in [`Task`](./Task):
ruhig, präzise, zurückhaltend – „Apple Store, nicht Times Square".
Sprache der Website und der Code-Kommentare: **Deutsch**.

Der Paketname in `package.json` lautet aus historischen Gründen noch
`omegaphone`; maßgeblich ist `lib/site.ts`.

## Befehle

```bash
npm install
npm run dev               # Entwicklungsserver
npm run build             # Server-Build (Vercel, Cloudflare Workers)
npm run build:static      # Statischer Export nach ./out (ohne /api)
npm run lint              # ESLint
npm run verify            # Prüfstand: die Regeln dieser Datei, ausgeführt
npm run verify:qr         # QR-Encoder gegen ISO/IEC 18004 prüfen
npm run verify:procedure  # Werkstattabläufe gegen die zugesagten Zeiten
npm run verify:inspection # Prüfprotokoll + Bestand gegen die eigenen Zusagen
npm run verify:support    # Update-Horizont gegen den Gerätekatalog
npm run verify:status     # Werkstattablauf gegen das Datenbankschema
npm run verify:cert       # Reparaturzertifikat: Format, Signatur, QR-Größe, Geheimnisse
npm run verify:instruments # Physik der Instrumente, Bruchmechanik, Drosselung
npm run verify:privacy    # Datenschutz-Nachweis: kein Weg nach draußen
npm run verify:invoice    # Geldrechnung: Cent, Steuergruppen, Ladenpreis

bash .github/scripts/verify-alle.sh   # alle verify:*-Skripte nacheinander
                                      # (genau das, was CI ausführt)

npm run cf:build          # Cloudflare-Worker bauen (OpenNext)
npm run cf:preview        # Worker lokal in workerd testen
npm run cf:deploy         # Auf Cloudflare Workers deployen

node scripts/generate-icons.mjs   # PWA-Icons neu rendern (headless Chromium)
node scripts/generate-og.mjs      # public/og.png neu rendern (Link-Vorschaubild)
```

Es gibt keine Test-Suite. Verifikation = `npm run build` + `npm run lint`
+ **`npm run verify`** + die fachlichen Prüfskripte.

### Der Prüfstand (`scripts/verify.mjs`)

Die Regeln in dieser Datei sind ausführbar. Der Grund steht in der
Fehlergeschichte des Projekts: Nacheinander sind ein Kontrastwert unter dem
Schwellenwert, jede Unterseite mit der Startseite als kanonischer URL,
Markdown-Sternchen in gerendertem Text, zweimal ein Backtick im GLSL-Literal
und ein reserviertes Wort als Shader-Variable durchgerutscht. Keiner dieser
Fehler war schwer zu finden. Alle waren schwer zu **bemerken**.

Geprüft wird:

| Prüfung | Worauf |
|---|---|
| Kontrast | alle Ink×Flächen-Paare in beiden Themes ≥ 4.5:1, Statusfarben, `--accent-contrast` auf `--accent`, kein `text-white` auf `bg-accent` |
| Redaktion | keine Markdown-Betonung in `lib/data/`-Textwerten, keine feste Garantiedauer außerhalb `site.ts` |
| Shader | kein Backtick im GLSL-Literal, keine GLSL-Schlüsselwörter als Bezeichner |
| Metadaten | jede Route nutzt `pageMeta()` |
| Offline-Vorrat | `public/sw.js` und `lib/pwa/precache.ts` nennen dieselben Seiten in derselben Reihenfolge, /notfall zuerst, gleicher Nachrichtenname |
| Export | eigener Canonical je Seite, `og:image` überall, nichts zugleich in Sitemap und auf `noindex` |

Die Export-Prüfungen laufen nur, wenn `./out` vorliegt – also nach
`npm run build:static`. In CI läuft der Prüfstand zweimal: vor dem Build für
den Quelltext, danach für den Export.

**Wer eine Regel ergänzt, ergänzt die Prüfung.** Und wer eine Prüfung
schreibt, baut den Fehler einmal absichtlich ein und sieht nach, ob sie
anschlägt – die `text-white`-Prüfung sah beim ersten Selbsttest nur in
`className`-Attribute und übersah damit genau die Stelle, an der der Fehler
tatsächlich saß.

### Die fachlichen Prüfskripte

Der Prüfstand deckt die Regeln dieser Datei ab. Daneben stehen neun Skripte,
die alle dasselbe prüfen: dass eine Zusage der Seite noch stimmt. Sie sind
kein Ersatz für Tests, sondern genau die Stellen, an denen ein stiller Fehler
die Website zur Lügnerin macht, ohne dass jemand etwas merkt.

**Alle neun laufen in CI**, und zwar an zwei Stellen: `pruefungen.yml` an
jedem Pull Request (das Tor vor dem Merge) und `nextjs.yml` beim Push auf
`main` (die letzte Bremse vor dem Veröffentlichen). Bis August 2026 taten
sie das nicht – es lief nur der Prüfstand und `verify:qr`, die übrigen
sechs starteten nur, wenn jemand daran dachte. Ein Prüfskript, das niemand
ausführt, ist ein Kommentar mit Laufzeit.

**Die Liste der Skripte steht in keiner Workflow-Datei.**
`.github/scripts/verify-alle.sh` liest sie aus `package.json` – jedes
Skript, dessen Name mit `verify:` beginnt, läuft mit. Zwei Workflows
brauchen die Liste, und zwei von Hand gepflegte Fassungen wären dieselbe
Falle wie beim Offline-Vorrat: Sie driften auseinander, und das neueste
Prüfskript ist dann genau das, welches in CI fehlt. Wer `verify:neu`
anlegt, trägt nirgends etwas nach.

- `verify:qr` – der QR-Encoder gegen ISO/IEC 18004. Ein Fehler hier ergibt
  einen Ausdruck, den kein Telefon liest.
- `verify:procedure` – die Summe der Arbeitsschritte gegen
  `repairMeta[kind].minutes`. Auf /reparatur steht ausdrücklich, dass beides
  übereinstimmt.
- `verify:inspection` – die Anzahl der Positionen im Prüfprotokoll gegen
  `site.checkpoints` (das „40-Punkte-Protokoll“), plus jedes Gerät im
  Bestand gegen seinen eigenen Zustandsgrad.
- `verify:support` – jedes Modell im Katalog hat einen Update-Horizont,
  jede Angabe einen Beleg, und die Daten stehen in plausibler Reihenfolge.
  Schlägt außerdem an, wenn `SUPPORT_CHECKED` über ein Jahr alt ist. Dazu die
  Rechtsangaben auf /ersatzteile: der Stichtag der Ökodesign-Verordnung auf
  den Tag genau, die Fristen, und dass ein nicht erfasstes Gerät keine
  Jahreszahl zugeordnet bekommt.
- `verify:status` – der Werkstattablauf in `lib/tickets/status.ts` gegen das
  Postgres-Enum in `supabase/migrations/`: gleiche Zustände, gleiche
  Reihenfolge. Dazu Kontaktkanäle, die Form des Vorgangscodes, die Namen der
  Realtime-Kanäle und die Zusage, dass es auf den Vorgangstabellen keine
  Policy für `anon` gibt.
- `verify:cert` – das Reparaturzertifikat gegen die Zusage auf /pruefen. Es
  kippt **jedes einzelne Bit** des unterschriebenen Datensatzes und prüft, dass
  die Signatur jedes Mal bricht. Dazu Hin- und Rückweg des Binärformats (auch
  mit Umlauten an der Längengrenze), die QR-Version des schlimmsten Falls und
  die Stimmigkeit des Schlüsselrings. Und seit einem realen Vorfall: der
  gesamte Quelltext gegen privates Schlüsselmaterial, plus die Frage, ob ein
  öffentlicher Schlüssel wirkungslos neben dem Ring liegt.
- `verify:instruments` – die Messgeräte auf /check und die Bruchmechanik auf
  /ersatzteile. Fallgesetze und Inglis-Formel gegen unabhängig gerechnete
  Sollwerte, der Klirrfaktor gegen ein Spektrum mit bekanntem Inhalt, und die
  Frequenzachse gegen sich selbst: keine Bildspalte ohne Bin, keine Lücke,
  jede Oktave gleich breit. Dazu das Arbeitspaket des Drosselschreibers:
  bestimmt, ganzzahlig, und doppelte Arbeit dauert doppelt so lange.
- `verify:privacy` – der Fingerabdruck-Nachweis auf /datenschutz. Prüft im
  Quelltext, dass die beteiligten Dateien kein `fetch`, kein `sendBeacon`,
  keinen Browserspeicher und keinen Zählpixel enthalten, dass jede gelesene
  Angabe auch angezeigt wird, und dass die Seite keine Häufigkeit behauptet.
- `verify:invoice` – die Geldrechnung des Rechnungswerkzeugs. Ein Cent-Fehler
  ist dort unsichtbar: Das gedruckte Blatt bleibt plausibel, während der
  Empfänger die E-Rechnung Tage später automatisch zurückweist, weil
  EN 16931 nachrechnet. Geprüft werden keine Beispiele, sondern
  **Invarianten** gegen 4.000 gewürfelte Belege – Netto + Steuer = Brutto auf
  jeder Ebene, Steuer je Gruppe aus der Bemessungsgrundlage (BR-CO-17),
  Positionen summieren sich auf ihre Gruppe, kein Steuerausweis bei § 19 und
  § 25a, überall ganzzahlige Cent. Dazu die Zusage „nie teurer als
  eingegeben“ gegen jeden Bruttopreis von 0,01 € bis 2.000 €. Der Würfel hat
  einen festen Startwert – ein Fehlschlag in Lauf 3182 muss sich nachstellen
  lassen.

## Deployment (Cloudflare Workers – empfohlen)

Voller Next.js-Server über den OpenNext-Adapter, damit `/api/kontakt`
serverseitig läuft.

```bash
npm run cf:build      # erzeugt .open-next/worker.js + .open-next/assets
npm run cf:preview    # lokal in workerd prüfen
npx wrangler login
npm run cf:deploy
```

- `wrangler.jsonc`: `nodejs_compat` ist **erforderlich** – der Kontakt-Endpunkt
  nutzt `Buffer` für den Bild-Upload.
- Secrets nicht in `wrangler.jsonc`, sondern:
  `npx wrangler secret put RESEND_API_KEY`, `CONTACT_FROM`, optional `CONTACT_TO`.
- Der Rate-Limiter in `app/api/kontakt/route.ts` ist prozesslokal. Auf Workern
  verteilt sich der Traffic über Isolates, er wirkt also nur als grobe Bremse.
  Für harte Limits KV oder Durable Objects nachrüsten.

## Deployment (Cloudflare Pages / statisch)

```bash
npm run build:static  # → ./out, alle Seiten statisch, ohne /api
```

`scripts/build-static.mjs` legt `app/api` vor dem Build beiseite und stellt es
danach zurück (`output: "export"` verträgt keine POST-Route-Handler). Ohne
Serverfunktion öffnet das Formular einen fertigen E-Mail-Entwurf – gesteuert
über `NEXT_PUBLIC_STATIC_EXPORT`.

## Deployment (GitHub Pages)

- `.github/workflows/nextjs.yml` baut bei Push auf `main` (mit `GITHUB_PAGES=true`
  über `npm run build:static`) und deployt `./out`
  nach GitHub Pages → `https://nicozrm.github.io/Dr.Smartphone48/`.
- Einmalig im Repository: **Settings → Pages → Source = „GitHub Actions"**.
  Ohne diese Einstellung schlägt der Deploy-Job fehl.
- Der Workflow setzt `GITHUB_PAGES=true`; `next.config.ts` aktiviert dann
  `basePath: "/<Repository-Name>"` und setzt `NEXT_PUBLIC_SITE_URL` auf die
  Projektseite, damit Canonical, Sitemap, robots.txt und JSON-LD dorthin zeigen
  statt auf `https://drsmartphone48.de`. Lokal (ohne die Variable) gibt es
  weder basePath noch URL-Umschaltung.
- **Der Unterpfad ist nicht fest verdrahtet, sondern kommt aus
  `GITHUB_REPOSITORY`.** Das hat einen Anlass: Das Repository hieß bis zum
  8.8.2026 `Koko`, und die Umbenennung nahm die Seite vom Netz, ohne dass
  irgendetwas fehlschlug. Der Deploy lief durch und meldete Erfolg; im
  Export stand nur überall noch `/Koko` – Stilvorlagen, Skripte, Schriften,
  jeder interne Link, Canonical und Vorschaubild. Wer die Seite aufrief,
  bekam nacktes HTML, in dem kein Klick funktionierte. Ein Name, den man an
  zwei Stellen pflegen muss, wird an einer davon vergessen.
- **Eine Umbenennung bricht trotzdem jede gedruckte Adresse.** Der
  Unterpfad steckt im QR-Code jedes Reparaturzertifikats und in jedem
  Beleg, der die Werkstatt schon verlassen hat. Der Konfiguration ist das
  egal, den Kunden nicht. Wer den Namen ändert, weiß das vorher – und
  sobald echte Belege im Umlauf sind, ist eine eigene Domain die Antwort,
  nicht ein weiterer Name unter `github.io`.
- Eigene Domain später: bei Root-Domain `basePath` leer lassen und eine
  `CNAME`-Datei (via `public/CNAME`) ergänzen; `gitHubPagesUrl` in
  `next.config.ts` entfällt dann.
- Lokal prüfen: `GITHUB_PAGES=true npm run build:static`, dann
  `npx serve out` – die Seite liegt unter `/Dr.Smartphone48/`. Ohne
  `GITHUB_REPOSITORY` gilt der Name aus `next.config.ts` als Rückfallwert.
- **Wichtig:** Verweise auf Dateien in `public/` (Service Worker, Manifest-Icons)
  bekommen den basePath NICHT automatisch – dafür
  `process.env.NEXT_PUBLIC_BASE_PATH` voranstellen (siehe `app/manifest.ts`,
  `components/pwa/ServiceWorkerRegister.tsx`). `public/sw.js` leitet seinen
  Basis-Pfad zur Laufzeit aus `self.location` ab.
- Wegen `output: "export"` brauchen Metadata-Routen (`sitemap.ts`, `robots.ts`,
  `manifest.ts`) `export const dynamic = "force-static"`. Keine Server Actions,
  keine API-Routen, kein `next/image`-Optimizer (unoptimized).

## Architektur

```
app/                     App-Router-Seiten (alle statisch prerendert)
  page.tsx               Landing Page (Hero, Pillars, Werkzeuge, Anatomie,
                         Röntgen, Stats, CTA)
  reparatur/             Sofortpreis-Rechner (Signature-Feature) + Werkstattablauf + FAQ
  notfall/               Notfall-Protokolle (ohne JS lesbar, offline im Cache)
  check/                 Geräte-Check: Sensor-Diagnose im Browser, dazu fünf
                         Instrumente (Stethoskop, Klirrfaktor, Sturzschreiber,
                         Drosselschreiber, Pixel-Wecker)
  vorbereitung/          Übergabe-Assistent: was vor der Abgabe zu tun ist
  ankauf/                Restwert-Rechner mit offengelegter Rechnung
  zwilling/              Digitaler Zwilling, Akku-Coach, Reparieren-oder-neu
  versorgung/            Update-Horizont: bis wann jedes Modell noch
                         Sicherheitsupdates bekommt
  ticket/                Reparatur-Ticket + Übergabeprotokoll (noindex),
                         am Ende die freiwillige Anmeldung eines Vorgangs
  status/                Vorgangsnummer eingeben …
  status/[ticketCode]/   … und den Stand verfolgen (Realtime, noindex; im
                         statischen Export ausgeklammert)
  refurbished/           Bestand (Gitter) …
  refurbished/[id]/      … und je Gerät eine Akte: Prüfprotokoll mit allen
                         40 Positionen, Messwerte, Product-JSON-LD, druckbar
  ersatzteile/ werkstatt/ kontakt/
  impressum/ datenschutz/ agb/ offline/ not-found.tsx
  pruefen/               Reparaturzertifikat prüfen (öffentlich, ohne Server)
  intern/rechnung/       Rechnungswerkzeug (nicht verlinkt, noindex, kein Server)
  intern/zertifikat/     Zertifikat ausstellen (nicht verlinkt, noindex, kein Server)
  intern/werkstatt/      Vorgangs-Dashboard (nicht verlinkt, noindex, Anmeldung)
  api/kontakt/           Route Handler für das Formular (nur im Server-Build)
  api/tickets/           Vorgang anmelden (POST)
  api/status/[code]/     Vorgang lesen (GET, redigiert) und ändern (PATCH)
  api/werkstatt/         Anmeldung, Liste und Akte für das Dashboard
  layout.tsx             Root-Layout: Metadata, JSON-LD, Header/Footer, SW-Registrierung
  globals.css            Design-Tokens (CSS-Variablen) + Tailwind-4-Theme + Motion + Druck
  sitemap.ts robots.ts manifest.ts   Metadata-Routen (force-static)
components/
  ui/                    Primitives: Button, Icon (eigenes SVG-Set), Reveal,
                         SectionHeading, ThemeToggle, QrCode, PrintButton
  layout/                Header, Footer, Logo
  sections/              Faq, RefurbishedGrid/-Card, DiagramShowcase, ContactForm,
                         Reviews (Google-Aggregat), LiveStatus (Öffnungsstatus)
  configurator/          Configurator (Preislogik) + DeviceDiagram (SVG-Explosion)
  experience/            Bootloader, CommandPalette (⌘K), ShaderField (WebGL-Hero),
                         DeviceExploded, XRay, MagneticField, ScrollProgress
  check/                 DeviceCheck (Display-, Sensor-, Audio-, Akku-Tests),
                         Stethoscope (Spektrum + Wasserfall),
                         Distortion (Klirrfaktor über die Lautstärke),
                         DropForensics (Beschleunigungsschreiber),
                         ThermalTrace (Drosselung unter Last),
                         PixelWake (hängende Bildpunkte lösen)
  handover/              HandoverAssistant (Vorbereitung zur Abgabe)
  twin/                  DigitalTwin, RepairOrReplace
  battery/               BatteryCoach (3-Jahres-Prognose)
  resale/                ResaleCalculator (Ankauf)
  ticket/                RepairTicket, DamageMap (Schadenskarte),
                         TicketRegistration (Anmeldung – nur mit Backend)
  status/                TicketStatusView (lädt + hört zu), StatusTimeline,
                         StatusBadge, TicketLookup
  workshop/              WorkshopDashboard, TicketList, TicketDetail,
                         StatusControl, WorkshopStats, WorkshopLogin,
                         ShortcutHelp
  emergency/             RescueClock
  parts/                 DisplayCompare (echte Eingabeverzögerung),
                         PwmDemo (Flimmern als Zeitdiagramm),
                         CrackTip (Spannungsüberhöhung am Riss),
                         RepairLaw (Ökodesign-Verordnung je Gerät)
  procedure/             RepairProcedure (Werkstattablauf im Zeitraffer)
  support/               SupportHorizon (Zeitachse), SupportTable (alle Modelle)
  cert/                  CertificateSeal (das Siegel), SignatureGlyph,
                         CheckpointGrid, VerifyView (Prüfseite),
                         CertificateIssuer (Werkstattwerkzeug)
  invoice/               InvoiceBuilder (Editor) + InvoiceSheet (das Blatt, DIN 5008)
  privacy/               Fingerprint (der Nachweis auf /datenschutz)
  pwa/                   ServiceWorkerRegister, OfflineStock (der Kassensturz)
lib/
  site.ts                Stammdaten (Name, Adresse, URL …) – zentrale Quelle
  seo.tsx                pageMeta() – Canonical/OG pro Seite, Breadcrumbs, JsonLd
  qr.ts                  QR-Encoder nach ISO/IEC 18004 (Byte-Modus, Stufe M, v1–20)
  imei.ts                Luhn-Prüfung mit offengelegter Rechnung
  ticket.ts              Ticket-Zustand aus der Adresse, Vorgangsnummer, .ics
  resale.ts              Ankauf-Bewertung als Liste begründeter Posten
  battery.ts             Alterungsmodell (kalendarisch + zyklisch)
  format.ts detect.ts theme.ts
  viewTransition.ts      Überführung der Gerätesignatur (die einzige im Projekt)
  data/                  devices.ts (Modelle, Preise, Ankaufswerte), refurbished.ts
                         (Bestand inkl. Zyklen, Prüfdatum, ersetzte Teile, Befund),
                         inspection.ts (die 40 Prüfpositionen), procedure.ts
                         (Werkstattschritte), support.ts (Update-Horizont je
                         Modell), acoustics.ts (Frequenzmarken),
                         repairlaw.ts (Ökodesign-Verordnung, BGB-Rechte),
                         faq.ts, reviews.ts, emergency.ts, handover.ts
  audio/                 spectrum.ts (logarithmische Frequenzachse, Farbrampe,
                         Klirrfaktor)
  motion/                impact.ts (Fallgesetze, Bremsweg, Untergründe),
                         crack.ts (Spannungsüberhöhung nach Inglis)
  perf/                  throttle.ts (Arbeitspaket, Median, Auswertung)
  privacy/               signals.ts (was ein Browser ungefragt preisgibt)
  pwa/                   precache.ts (die Vorratsliste, gegen sw.js geprüft)
  cert/                  format.ts (Binärformat + base64url), crypto.ts
                         (ECDSA P-256, Gerätebindung), keys.ts (öffentlicher
                         Schlüsselring), glyph.ts (Signaturbild), store.ts
  invoice/               types.ts calc.ts (Cent-Arithmetik) catalog.ts validate.ts
                         (§ 14 UStG) store.ts (localStorage) girocode.ts
                         einvoice.ts + cii.ts (E-Rechnung nach EN 16931)
  tickets/               status.ts (die acht Zustände), code.ts (Vorgangscode),
                         types.ts, validate.ts, public-view.ts (Redaktion),
                         repository.ts (einzige Datenzugriffsschicht),
                         registration.ts, links.ts
  supabase/              env.ts (gibt es ein Backend?), admin.ts (Service-Role,
                         nur Server), server.ts (Sitzung + requireStaff),
                         browser.ts (nur Realtime), database.ts (Schema als Typ)
  notify/                types.ts (Adapter-Vertrag), registry.ts, dispatch.ts,
                         messages.ts, adapters/ (email, webhook, push)
  realtime/              topics.ts, useStatusChannel.ts
  api/                   respond.ts (Antwortform), rate-limit.ts, client.ts
                         (jede Adresse genau einmal)
  workshop/              useWorkshopTickets.ts, useShortcuts.ts
supabase/
  migrations/            Schema, RLS, Realtime – in dieser Reihenfolge
  README.md              Einrichtung, Personal freischalten, Aufbewahrung
public/
  sw.js                  Handgeschriebener Service Worker (Precache, /offline-Fallback)
  og.png                 Link-Vorschaubild 1200×630 (scripts/generate-og.mjs)
  icons/                 PWA-Icons
scripts/
  build-static.mjs       Statischer Export (legt app/api und app/status/[…] beiseite)
  generate-icons.mjs     PWA-Icons rendern
  verify-qr.mjs          QR-Encoder gegen die Norm prüfen
  verify-procedure.mjs   Ablaufzeiten gegen repairMeta.minutes
  verify-inspection.mjs  Prüfpositionen gegen site.checkpoints, Bestand gegen Grad
  verify-support.mjs     Update-Horizont gegen den Gerätekatalog
  verify-status.mjs      Werkstattablauf gegen das Datenbankschema
  verify-cert.mjs        Zertifikatsformat, Signatur bitweise, QR-Größe
  verify-instruments.mjs Sturzphysik und Bruchmechanik gegen das Tafelwerk,
                         Spektrum-Abbildung, Klirrfaktor
  verify-privacy.mjs     Fingerabdruck-Nachweis: kein Weg nach draußen
  verify-invoice.mjs     Geldrechnung: Invarianten, Steuergruppen, Ladenpreis
```

## Konventionen

- **Design-Tokens** ausschließlich über die CSS-Variablen in `app/globals.css`
  (Farben `--ink-*`/`--surface-*`, Radius `--radius-*`, Motion `--ease-*`,
  `--duration-*`). Keine Ad-hoc-Farben oder -Timings.
- **Der Akzent atmet – aber nur als Fläche.** `--accent-a` und `--accent-b`
  sind die Endpunkte; die Klasse `.breathe` (an der primären Schaltfläche)
  wandert über zwölf Sekunden zwischen ihnen. `--accent` selbst steht still
  und gilt für Linien, Schrift und Ränder. Wer den Ton ändert, ändert alle
  drei Werte gemeinsam.

  **Nicht auf Custom Properties umbauen.** Der naheliegende Weg – eine per
  `@property` registrierte Zahl animieren und `--accent` daraus mischen –
  kostet auf einem vierfach gedrosselten Telefon 1282 ms zusätzliche
  Stil-Neuberechnung, mehr als alles andere auf der Seite zusammen: Chromium
  rechnet bei animierten Custom Properties je Bild den Stil neu, weitgehend
  unabhängig davon, ob sie vererbt werden (672 ms selbst an nur drei
  Elementen). Die direkte Animation von `background-color` kostet 83 ms.
  Gemessen mit `Tracing` über `UpdateLayoutTree`, Median aus drei Läufen.
- **Animationen**: dezent und zweckgebunden (siehe `Task`). Scroll-Reveals über
  die `Reveal`-Komponente (IntersectionObserver setzt `data-revealed`, Bewegung
  lebt in CSS). `prefers-reduced-motion` wird überall respektiert; ohne JS
  bleibt alles sichtbar (`html[data-js]`-Gate).
- **Überführungen (View Transitions) gibt es genau eine**, und sie hat vier
  Ausschaltbedingungen: `lib/viewTransition.ts`. Die Gerätesignatur wandert im
  Sofortpreis-Rechner von der Markenkachel in den Kopf der Vorschau.

  Die Bedingung, an der die erste Fassung gescheitert ist: **Start und Ziel
  müssen gleichzeitig im Bild sein.** Der Kopf der Vorschau stand zunächst
  unter dem Diagramm – bei 1440 × 900 also unterhalb des sichtbaren Bereichs,
  und die Signatur flog aus dem Fenster. Deshalb steht er jetzt darüber, auf
  Höhe der Kacheln, und unter 1024 px Fensterbreite läuft die Überführung gar
  nicht erst (dort liegt die Vorschau weit unter den Schritten).

  Zwei Dinge, die man dabei falsch machen kann: Ein zweites Element mit
  demselben `view-transition-name` in derselben Aufnahme bricht die
  Überführung ab – der Name wird deshalb im Klick gesetzt und im selben
  Rutsch wieder entfernt. Und `::view-transition-old(root)` bleibt auf
  `display: none`: Eine überblendete Seitenaufnahme legte sich eine halbe
  Sekunde über den gestaffelten Einlauf der Modellkacheln.
- Server Components als Default; `"use client"` nur wo nötig
  (Reveal, Configurator, DiagramShowcase, ContactForm, ServiceWorkerRegister,
  Bootloader, CommandPalette, DeviceCheck, DigitalTwin, ShaderField,
  die Werkzeuge unter check/, twin/, battery/, resale/, ticket/, parts/).
- Alle Firmendaten (Adresse, Telefon, Reparatur- und Ankaufspreise,
  Impressum) sind **Platzhalter** und vor dem Livegang zu ersetzen.

### Kontrast: die Tonleiter ist gemessen, nicht geschätzt

Alle vier Textstufen (`--ink-strong`, `--ink`, `--ink-soft`, `--ink-faint`)
erreichen in beiden Themes mindestens **4.5:1** gegen die dunkelste Fläche, auf
der sie stehen (`--surface-sunken`). Das ist kein Zufallsergebnis: Zuvor lag
`--ink-soft` bei 4.31:1 und `--ink-faint` bei 2.25:1 – an ihnen hängt der
gesamte Fließtext bzw. die Vertrauenszeile im Hero.

Wer eine dieser Farben anfasst, rechnet nach. Ebenso bei neuen Status- oder
Flächenfarben.

Auf gefüllten Akzentflächen gilt **`text-accent-contrast`**, nie `text-white`.
Grund: `--accent` muss im Dunkelmodus aufgehellt sein, um als Textfarbe auf
Schwarz zu bestehen – Weiß darauf käme dann nur noch auf 3.33:1. Das eigene
Token löst hell zu Weiß und dunkel zu `#101114` auf.

### Gesperrte Bereiche: `inert`, nicht `aria-hidden`

Ausgegraute Abschnitte (etwa die noch nicht freigeschalteten Schritte im
Konfigurator) bekommen `inert`. `aria-hidden` mit weiterhin fokussierbaren
Schaltflächen darin ist laut WCAG unzulässig und erzeugt eine tote Zone: Die
Tabulatortaste landet in einem Feld, das die Vorlesehilfe nicht ankündigt und
die Maus nicht bedienen kann. `inert` nimmt Fokusreihenfolge,
Zeigerereignisse und Barrierefreiheitsbaum in einem Zug – ein zusätzliches
`pointer-events-none` erübrigt sich damit.

### Metadaten: jede Seite setzt ihre eigenen

Jede Route exportiert `metadata` über **`pageMeta()`** aus `lib/seo.tsx` –
niemals ein handgeschriebenes `Metadata`-Objekt.

Grund: Next.js vererbt `alternates.canonical` und `openGraph.url` aus dem
Root-Layout an jede Seite, die sie nicht selbst setzt. Standen sie dort, meldete
**jede** Unterseite die Startseite als kanonische URL – für Google sind
`/reparatur`, `/check` und `/kontakt` dann Duplikate und fliegen aus dem Index.
Deshalb stehen im Root-Layout bewusst weder `canonical` noch `openGraph.url`.

Prüfen lässt sich das nach jedem Build:

```bash
grep -o '<link rel="canonical" href="[^"]*"' .next/server/app/*.html
```

Jede Zeile muss einen **eigenen** Pfad zeigen.

### Redaktionsregel: keine erfundenen Zahlen

Sichtbare Kennzahlen (Bewertungen, Stückzahlen, Quoten) müssen belegbar sein
und aus `lib/site.ts` stammen, wenn es sie dort gibt. Widersprechen sich
sichtbarer Text und JSON-LD, wertet Google beides ab – und ein Besucher, der
zwei verschiedene Bewertungsschnitte auf einer Seite liest, glaubt keinem.
Dieselbe Regel gilt für `lib/data/reviews.ts` (nur wörtlich übernommene echte
Google-Rezensionen) und für Garantieangaben (immer `site.warrantyMonths`,
nie eine feste Zahl im Text).

Zwei Zahlen sind inzwischen maschinell abgesichert, weil sie ausdrücklich als
Zusage formuliert sind:

- **`site.checkpoints` (40 Punkte).** Der Prüfplan steht vollständig in
  `lib/data/inspection.ts` und wird auf jeder Geräteakte gedruckt.
  `verify:inspection` bricht ab, wenn Zahl und Positionen auseinanderlaufen.
- **`repairMeta[kind].minutes`.** Die Arbeitsschritte in
  `lib/data/procedure.ts` müssen sich exakt darauf summieren
  (`verify:procedure`).

Wer eine der beiden Zahlen ändert, ändert die andere Seite mit – sonst
verspricht die Website etwas, das der eigene Datenbestand widerlegt.

### Bestand aufbereiteter Geräte (`lib/data/refurbished.ts`)

Jedes Gerät trägt neben Preis und Zustandsgrad vier Felder, die im
Prüfprotokoll landen: `cycles`, `checkedOn`, `replaced` und `note`. Sie
werden bei der Aufbereitung erfasst, nicht beim Rendern erzeugt – ein
zufällig generierter Befund wäre genau die Sorte Behauptung, die diese Seite
vermeiden soll.

`verify:inspection` prüft den Bestand deshalb gegen sich selbst: Kapazität
über dem Mindestwert des eigenen Grades, „Akku ersetzt“ nur bei niedriger
Zyklenzahl, jeder Grad unterhalb „Wie neu“ mit benanntem Befund. Ein Gerät
ohne Befund, das trotzdem „Gut“ heißt, fällt durch.

### Update-Horizont (`lib/data/support.ts`)

Die heikelste Tabelle der Website: Sie nennt Datumsangaben, nach denen
Kunden entscheiden, ob sie 219 € in ein Gerät stecken – und sie veraltet von
selbst, weil Hersteller ihre Zusagen ändern.

Zwei Regeln halten das aus:

- **Jede Angabe trägt ihre Quellenart.** `hersteller` heißt: Der Hersteller
  hat den Zeitraum öffentlich zugesagt (Google und Samsung tun das seit 2023
  ausdrücklich). `schaetzung` heißt: Es gibt keine Zusage, nur ein bisher
  eingehaltenes Muster – das trifft auf Apple zu. Auf der Seite steht die
  Sorte immer dabei. Eine Schätzung, die aussieht wie eine Zusage, ist eine
  Lüge mit Zwischenschritt.
- **`SUPPORT_CHECKED` ist das Datum der letzten Prüfung.** `verify:support`
  warnt nach sechs Monaten und bricht nach zwölf ab. Wer die Tabelle prüft,
  setzt das Datum hoch – auch dann, wenn sich nichts geändert hat.

Die Restlaufzeit („noch 6 Monate") wird **im Browser** gerechnet, nicht beim
Bauen. Die Seite wird statisch exportiert; ein serverseitig gerechneter Wert
wäre auf dem Datum des letzten Deploys eingefroren und Monat für Monat
falscher. Ohne JavaScript bleiben die Datumsangaben stehen – sie sind die
Information, die Restlaufzeit ist die Bequemlichkeit.

### Rechnungswerkzeug (`/intern/rechnung`)

Internes Werkzeug, nicht verlinkt und nicht in der Sitemap: `noindex, nofollow`
per Seiten-Metadaten, `Disallow: /intern/` in `robots.ts`.

- **Kein Server.** Profil, Kundenarchiv, Entwurf und Verlauf liegen in
  `localStorage` (`lib/invoice/store.ts`). Rechnungsdaten enthalten Namen,
  Anschriften und IMEIs – was nie übertragen wird, kann nicht abfließen. Preis
  dafür: Der Bestand hängt am Gerät, deshalb Export/Import als JSON.
- **Beträge sind ganzzahlige Cent** (`lib/invoice/calc.ts`), gerundet pro
  Position. Nie in Euro-Fließkomma rechnen.
- **Preise stammen aus `lib/data/devices.ts`** (`lib/invoice/catalog.ts`), damit
  Rechnung und Sofortpreis-Rechner nicht auseinanderlaufen.
- **Das Blatt ist ein Blatt:** 210 × 297 mm, `overflow: hidden`, alle Maße in
  Millimetern, Anschriftfeld nach DIN 5008 Form B. Was nicht draufpasst, wird
  abgeschnitten.
- **Mehrseitigkeit** rechnet `lib/invoice/paginate.ts`: Es verteilt die
  Positionen auf Blätter, setzt auf jedes Folgeblatt einen Fortsetzungskopf
  („Rechnung … · Seite 2 von 2") und führt den **Übertrag** als erste Zeile
  mit. Der Übertrag ist der Bruttobetrag der vorangegangenen Blätter – dass
  Übertrag plus Folgepositionen wieder die Endsumme ergeben, prüft seit
  Neuestem `verify:invoice`, nicht mehr der nächste Mensch. Der Satz stand
  hier lange im Imperativ und war damit eine Bitte; der Übertrag ist aber
  die einzige Zahl auf dem Blatt, die ein Kunde tatsächlich nachrechnet.

  Der heikelste Pfad ist der, an dem der Summenblock nicht mehr aufs
  Vorblatt passt: Er bekommt ein eigenes Blatt, bis zu drei Zeilen wandern
  mit (kein Schusterjunge), und **danach werden die Überträge neu
  bestimmt** – die einzige Stelle, an der sie nachträglich verändert
  werden. Der Zufall trifft sie nicht zuverlässig, deshalb schreitet das
  Prüfskript die Grenze zusätzlich systematisch ab: jede Positionszahl von
  1 bis 60, mit und ohne Zahlungsabschnitt, kurze und lange Texte.

  Dass der Pfad wirklich abgedeckt ist, wurde nachgewiesen statt vermutet:
  Entfernt man die Neuberechnung der Überträge, fallen 610 von 1200
  gewürfelten Belegen durch.
- **Belegarten** (`lib/invoice/doctype.ts`): Rechnung, Kostenvoranschlag,
  Angebot, Gutschrift, Storno. Dieselben Positionen und dieselbe Rechenlogik,
  anderes Kürzel im Nummernkreis und andere Sprache im Blatt.
- **Der Briefkopf** (`components/invoice/Letterhead.tsx`) borgt sich drei
  Techniken aus dem Wertpapierdruck: Mikroschrift statt Haarlinie,
  Guillochenrosette als Wasserzeichen, Millimeterskala am Rand. Alle drei
  sind reines CSS/SVG – kein Bildmaterial, keine Schriftdatei, null Byte
  Ladelast.
- **Der Druck-Block in `globals.css` blendet `body > header` / `body > footer`
  aus, nicht `header` / `footer`.** Der Fuß des Rechnungsblatts trägt
  Steuernummer, USt-IdNr. und Bankverbindung; ein Selektor auf das nackte
  Element nähme genau die Pflichtangaben mit.
- Der GiroCode (EPC069-12) nutzt denselben Encoder wie der Rest der Seite
  (`lib/qr.ts`) und ist damit von `npm run verify:qr` erfasst. Es gab hier
  einmal eine zweite, eigene Umsetzung derselben Norm – ausgerechnet der Code,
  der zum Bezahlen auffordert, war dadurch der einzige ungeprüfte. Die
  längstmögliche EPC-Nutzlast liegt bei ~278 Zeichen und passt sicher hinein.

### E-Rechnung nach EN 16931 (`lib/invoice/einvoice.ts`, `cii.ts`)

Rechtlicher Hintergrund: Seit dem 1.1.2025 muss jedes deutsche Unternehmen
strukturierte E-Rechnungen **empfangen** können. Ausstellen muss sie ab dem
1.1.2027, wer über 800.000 € Vorjahresumsatz liegt – ab dem **1.1.2028 jeder**
im B2B-Geschäft. Eine Werkstatt, die einer GmbH ein Display tauscht, fällt
darunter.

Erzeugt werden zwei Ausprägungen derselben CII-Syntax (UN/CEFACT):
**ZUGFeRD 2.3 / Factur-X** (`urn:cen.eu:en16931:2017`) für Unternehmen und
**XRechnung 3.0** für Behörden. Beide entstehen im Browser, ohne Server.

- **Die Kennung der XRechnung lautet `urn:xeinkauf.de:kosit:xrechnung_3.0`**,
  nicht mehr `urn:xoev-de:kosit:standard:...`. Die KoSIT hat den Namensraum mit
  Version 3.0 gewechselt; die alte Kennung sieht fast gleich aus, gilt der
  Prüfung der Verwaltung aber als „keine XRechnung“.
- **CII ist ein sequenzielles Schema.** Die Reihenfolge der Elemente ist
  bindend – in `ram:ApplicableTradeTax` etwa CalculatedAmount → TypeCode →
  ExemptionReason → BasisAmount → CategoryCode → RateApplicablePercent. Wer
  umsortiert, produziert ein Dokument, das automatisch abgelehnt wird.
- **§ 19 und § 25a werden als Kategorie `E` mit Befreiungsgrund abgebildet.**
  Für die Differenzbesteuerung ist das gängige Praxis, aber keine reine Lehre –
  die Norm kennt dafür keine eigene Kategorie. Einmal vom Steuerbüro
  bestätigen lassen.
- Für die XRechnung sind Leitweg-ID (BT-10) und elektronische Adresse des
  Empfängers (BT-49) Pflicht. Beide stehen im Abschnitt „Empfänger“.

Prüfen mit dem Validator der Referenzimplementierung (Java erforderlich):

```bash
curl -sSLo validator.jar \
  https://repo1.maven.org/maven2/org/mustangproject/validator/2.24.0/validator-2.24.0-shaded.jar
# Wrapper, weil das Jar keine Main-Klasse mitbringt:
cat > Val.java <<'EOF'
import org.mustangproject.validator.ZUGFeRDValidator;
public class Val { public static void main(String[] a) throws Exception {
  System.out.println(new ZUGFeRDValidator().validate(a[0])); } }
EOF
javac -cp validator.jar -d . Val.java && java -cp .:validator.jar Val rechnung.xml
```

Erwartung: XRechnung `failed = 0`. Für ZUGFeRD bleibt genau eine Meldung
(BR-DE-21) – der Validator prüft immer gegen XRechnung, und ein ZUGFeRD-Beleg
trägt zu Recht die neutrale EN-16931-Kennung.

### Warum `calc.ts` gruppenweise rechnet

Die Steuer wird **je Steuersatz aus der Bemessungsgrundlage** abgeleitet, nicht
aus der Summe gerundeter Einzelsteuern. Das ist keine Feinheit: EN 16931
verlangt es in BR-CO-17, und beide Wege lagen im Test regelmäßig einen Cent
auseinander. Das gedruckte Blatt sah dabei weiterhin plausibel aus, während die
E-Rechnung automatisch zurückgewiesen wurde.

Damit ein Ladenpreis trotzdem stehen bleibt, gilt: **Der eingegebene Wert
bleibt unangetastet, verteilt wird nur der abgeleitete.** Bei Bruttoeingabe
stehen die Bruttobeträge der Positionen fest; die Nettobeträge werden mit der
Methode der größten Reste so verteilt, dass ihre Summe die Bemessungsgrundlage
trifft (`largestRemainder`). `netFromGross` sucht zusätzlich den Nettowert, der
die Bruttosumme **exakt** reproduziert – das gelingt in rund 84 % der Fälle.

**Die restlichen 16 % sind keine Ungenauigkeit, sondern eine Lücke.** Hier
stand lange das Beispiel „2 × 19,90 = 39,79“ als das, was nicht passieren
darf. Es kann aber gar nicht anders sein: Bei 19 % gibt es für 39,80 € kein
ganzzahliges Netto. 3344 Cent ergeben 39,79 €, 3345 Cent ergeben 39,81 €, und
dazwischen liegt nichts. Über alle Beträge gerechnet ist **jeder sechste
Bruttobetrag bei 19 % unerreichbar**. Wer hier eine exakte Summe verspricht,
verspricht etwas, das die Arithmetik nicht hergibt – die Regel erklärte sich
also ausgerechnet an einem Fall, den sie nicht einhalten kann.

**In der Lücke geht der Cent nach unten, nie nach oben.** Vorher entschied
das die Rundung: `start` ist der gerundete Quotient und fällt mal darüber,
mal darunter – über alle Lücken bei 19 % in 8404 Fällen nach oben und in 7562
nach unten. In gut der Hälfte der Lückenfälle zahlte der Kunde also **einen
Cent mehr, als ausgezeichnet war**; gemessen an allen Preisen von 0,01 € bis
2.000 € waren das 16.808 von 200.000. Ein ausgezeichneter Preis ist eine
Zusage: ihn zu unterschreiten ist folgenlos, ihn zu überschreiten nicht.
`netFromGross` nimmt deshalb den größten Nettowert, dessen Bruttobetrag den
eingegebenen **nicht übersteigt**. An BR-CO-17 ändert das nichts – die Steuer
folgt weiterhin aus der Bemessungsgrundlage, gleich welches Netto gewählt wird.

`verify:invoice` hält beides fest: die Invarianten gegen 4.000 gewürfelte
Belege und die Zusage „nie teurer als eingegeben“ gegen jeden Bruttopreis von
0,01 € bis 2.000 €.

### Vorgangsverwaltung (`/status`, `/intern/werkstatt`)

Der einzige Teil dieser Website mit einer Datenbank – und der einzige, der
**abschaltbar** ist. Ohne `NEXT_PUBLIC_SUPABASE_URL` läuft alles wie zuvor:
Der Sofortpreis-Rechner rechnet, das Ticket entsteht aus der Adresse, das
Übergabeprotokoll bleibt im Browser. Die Anmeldung und die Statusseite
erscheinen dann gar nicht erst. Einrichtung: `supabase/README.md`,
Variablennamen: `.env.example`.

**Die Grenze ist die Anmeldung.** Bis dahin speichert diese Website über einen
Besucher nichts, und das steht auf der Ticketseite als Zusage. Der Abschnitt
`TicketRegistration` überschreitet die Grenze bewusst: sichtbar getrennt vom
Protokoll, mit einer Liste dessen, was übertragen wird, und mit dem
`ConsentGate` davor. Vom Übergabeprotokoll geht dabei **nichts** mit –
Schadenskarte, Zubehör und Sperrcode bleiben im Arbeitsspeicher. Wer daran
etwas ändert, zieht `app/datenschutz` mit; dort steht der Abschnitt
„Reparaturvorgang anmelden“ und erscheint unter derselben Bedingung.

**Der Vorgangscode ist ein Schlüssel, kein Ausweis** (`lib/tickets/code.ts`).
Acht Zeichen aus einem Alphabet ohne I, O, 0 und 1, gezogen mit
`crypto.getRandomValues`. Wer ihn hat, sieht die Statusseite – deshalb steht
dort nichts, was in fremden Händen schadet. Was nach draußen geht, entscheidet
`toPublicTicket` in `lib/tickets/public-view.ts`, und zwar an genau einer
Stelle: kein Name, kein Telefon, keine E-Mail, keine IMEI, keine internen
Vermerke. Ein Vermerk wird nur sichtbar, wenn er mit `+` beginnt.

**Für Kunden gibt es keine RLS-Policy.** Nicht für `anon`, nicht für
`authenticated`. Die Statusseite liest ausschließlich über
`/api/status/[ticketCode]`, das serverseitig mit der Service-Role liest und
vorher redigiert. Eine Lese-Policy für `anon` wäre eine Lese-Policy für jeden,
der acht Zeichen durchprobiert. `verify:status` schlägt an, wenn doch eine
entsteht.

**Realtime ist ein Signal, keine Datenquelle.** Kein `postgres_changes` – das
verschickte die ganze Zeile samt Name, Telefon und IMEI. Stattdessen sendet
der Trigger je Kanal genau so viel, wie der Empfänger braucht:

- `vorgang:<CODE>` – Zustand und zwei Zeitstempel. Die Kundenseite schaltet
  damit sofort um und lädt die Zeitleiste entprellt nach.
- `werkstatt:vorgaenge` – **nur ein Zeitstempel.** Das Dashboard lädt bei
  jedem Anstoß ohnehin über die angemeldete API nach.

Kein Intervall, kein Polling.

Beide Kanäle sind **öffentlich**, und das ist kein Versehen: Policies auf
`realtime.messages` kann die Rolle `postgres` nicht anlegen (die Tabelle
gehört `supabase_realtime_admin`), private Kanäle ohne Policy lassen niemanden
zu. Die Sicherheit steckt deshalb in der Nutzlast. Themennamen lassen sich
nicht durchsuchen – wer `vorgang:K7M2-B94X` hören will, muss den Code kennen,
dasselbe Modell wie bei der Statusseite. Und der Werkstattkanal, dessen Name
im JavaScript steht, trägt nichts, was jemandem nützt. `verify:status` prüft
genau das: Steht dort eines Tages ein Vorgangscode, schlägt es an.

**Der Ablauf steht zweimal**, in TypeScript und als Postgres-Enum. Das ist
unvermeidbar und deshalb maschinell abgesichert: `npm run verify:status`
vergleicht beide Listen zeichen- und reihenfolgengenau. Wer einen Zustand
hinzufügt, ändert beide Seiten – sonst lehnt die Datenbank ab, was die
Oberfläche anbietet.

**Ein Statuswechsel ist unteilbar.** Vorgang und Historie schreibt die
Datenbankfunktion `apply_ticket_status` in einer Transaktion; `changed_by`
kommt bei angemeldeten Aufrufen aus dem Token, nicht aus dem Parameter. Welche
Übergänge erlaubt sind, entscheidet dagegen `lib/tickets/status.ts` –
vorwärts frei, genau ein Schritt zurück. Zwei Implementierungen derselben
Regel driften auseinander.

**Zugang zur Werkstatt:** Supabase Auth plus ein Eintrag in `workshop_staff`.
Beides ist nötig, und den zweiten Teil kann nur jemand mit Datenbankzugriff
setzen – ein Dashboard, an dem man sich selbst freischaltet, ist keins. Der
Service-Role-Schlüssel liegt nie im Browser; das Dashboard arbeitet mit dem
Token der angemeldeten Person, und die Policies entscheiden.

**Im statischen Export gibt es die Vorgangsverwaltung nicht.**
`scripts/build-static.mjs` legt `app/api` und `app/status/[ticketCode]`
beiseite (ein dynamisches Segment braucht dort eine vollständige Werteliste,
und eine leere lehnt Next.js ab). `/status` und `/intern/werkstatt` stehen
trotzdem und sagen, dass es hier nichts zu bedienen gibt, statt in einen
Ladebalken zu laufen.

**Benachrichtigungen sind Adapter, keine Anbieter** (`lib/notify/`). E-Mail
läuft über Resend – dieselben Variablen wie das Kontaktformular. WhatsApp, SMS
und Push gehen an einen eigenen HTTPS-Endpunkt mit fester Nutzlast, damit der
Anbieter austauschbar bleibt. Ein Adapter ohne Zugangsdaten meldet
`isConfigured() === false` und sendet nicht; das Dashboard zeigt, was fehlt.
Benachrichtigt wird nur bei drei Zuständen und nur, wenn der Kunde einen Weg
gewählt hat – Vorauswahl ist „keine Nachrichten“.

### Zwei Instrumente auf `/check`

Der Geräte-Check oben auf der Seite zählt zwölf Prüfpunkte zu einem Befund
zusammen. Darunter stehen zwei Werkzeuge, die das ausdrücklich **nicht** tun:
Stethoskop und Beschleunigungsschreiber liefern Messwerte, und die Deutung
bleibt beim Menschen. Sie in die Liste zu hängen hieße, ein Spektrum in ein
Häkchen zu übersetzen – und genau diese Übersetzung wäre die Behauptung, die
hier niemand aufstellen will. Wer ein drittes Instrument ergänzt, hält es
ebenfalls aus dem Befund heraus.

**Stethoskop: die Aufbereitung muss aus.** `getUserMedia` liefert
voreingestellt einen für Sprache aufbereiteten Kanal. Besonders die
Rauschunterdrückung ist hier fatal, weil sie gezielt *gleichförmige* Geräusche
entfernt – also genau Spulenfiepen und Motorbrummen. Mit Voreinstellung fände
das Werkzeug zuverlässig nichts, und niemand käme auf die Idee, dass es daran
liegt. `echoCancellation`, `noiseSuppression` und `autoGainControl` stehen
deshalb alle drei auf `false`, wie schon beim Frequenzgang-Test daneben.

**Die Regel gilt für jede Mikrofonmessung, auch im Geräte-Check.** Der
Pegeltest oben auf der Seite war lange die Ausnahme – er öffnete den Kanal
mit `{ audio: true }`, also mit voller Aufbereitung. Von den dreien ist
dort die **Verstärkungsregelung** die schlimmste: Ihre ganze Aufgabe ist
es, leise Aufnahmen laut zu machen, also genau den Befund zu beseitigen,
den der Test sucht. Ein Mikrofon mit Staub im Schacht oder einem
angelaufenen Kontakt wurde geradegezogen und als „in Ordnung“ gemeldet.

Das war ausgerechnet an der Stelle falsch, an der es am meisten wiegt: Das
Stethoskop daneben liefert Messwerte für einen Menschen, der Pegeltest
liefert ein Häkchen in den zusammengefassten Befund.

**Und er hat keinen festen Grenzwert mehr.** Ohne Verstärkungsregelung
hängt der Pegel an Mikrofonempfindlichkeit, Abstand, Stimme und Umgebung –
eine feste Schwelle („über 12 % ist in Ordnung“) wäre für ein Telefon am
Küchentisch geraten. Verglichen wird deshalb der lauteste Moment mit dem
leisesten **derselben Aufnahme**, dasselbe Verfahren wie beim
Drosselschreiber, der sich ebenfalls erst auf das Gerät einmisst.

Drei Dinge, die dabei zusammenhängen (`lib/audio/level.ts`):

- **Erst die Frage nach Stille, dann das Verhältnis.** Ein totes Mikrofon
  liefert einen Untergrund von null; blind gerechnet käme unendlich heraus
  und das tote Gerät bestünde am besten von allen. `verify:instruments`
  prüft genau diesen Fall.
- **Die Grenze der Stille ist gerechnet**, nicht gegriffen: Das Rauschen
  einer Quantisierung in Schritten von 1/128 hat den Effektivwert
  Schritt/√12. Wer den Wert anfasst, ändert die Rechnung im Prüfskript mit.
- **Gemessen wird in Gleitkomma**, nicht als Byte. Der Untergrund liegt in
  der Größenordnung der 8-Bit-Quantisierung und verschwände in ihr.

**Keine Aussage über die Empfindlichkeit.** Der Test unterscheidet ein
Mikrofon, das aufnimmt, von einem, das schweigt – nicht ein gutes von
einem schwachen. Dafür bräuchte es eine bekannte Schallquelle in bekanntem
Abstand, also einen Messplatz. Das steht auf der Karte dabei. Und eine
Aufnahme ohne Ausschlag ist **kein Mangelbefund**, sondern eine Bitte um
Wiederholung: Wer nichts gesagt hat, hat kein defektes Gerät. Sie zählt
deshalb auch nicht als gelaufener Test.

**Die Frequenzachse ist logarithmisch, und das ist keine Kosmetik.** Linear
aufgetragen läge die halbe Bildbreite zwischen 12 und 24 kHz, wo bei einem
Telefon nichts passiert, während sich Netzbrummen und Vibrationsmotor die
ersten zwanzig Pixel teilten. `verify:instruments` prüft, dass jede Oktave
gleich breit ist und keine Bildspalte ohne Bin bleibt.

**Der Ablesewert schweigt, wenn nichts da ist.** Unterhalb der Rauschgrenze ist
der „lauteste Ton" der lauteste Punkt des Eigenrauschens; eine Frequenz dafür
anzugeben wäre eine Messung von nichts mit drei Ziffern Genauigkeit. Frequenz
und Pegel hängen deshalb an derselben Bedingung. Aus demselben Grund rundet
`peakFrequency` seine Grenzen nach innen, während `columnBins` nach außen
rundet: Eine Bildspalte muss lückenlos abdecken, ein Ablesewert darf nicht auf
eine Frequenz zeigen, die es auf der Achse nicht gibt (der erste Entwurf
meldete den Gleichanteil bei 23 Hz).

**Die eine Leinwand im Projekt.** Der Rest dieser Website kommt ohne Canvas
aus – der PWM-Vergleich auf /ersatzteile ist eine CSS-Kachel. Der Wasserfall
ist die Ausnahme: 600 einzeln eingefärbte Bildpunkte je Bild, dazu das
Verschieben des Bisherigen um eine Zeile. Als DOM wären das 120.000 Knoten in
Bewegung.

**Der Sturzschreiber misst den freien Fall, nicht den Aufprall.** Ein
Beschleunigungsmesser zeigt in Ruhe 1 g und im Fall 0 g; der Fall dauert aus
einem Meter 452 ms und ist bei 60 Messwerten je Sekunde gut aufgelöst. Der
Aufprall dauert etwa eine Millisekunde – da nimmt der Sensor meist gar keinen
Wert. Der angezeigte Spitzenwert wird deshalb ausdrücklich als **Untergrenze**
bezeichnet, mit der Rechnung daneben. Ein Messgerät, das seine eigene Grenze
verschweigt, ist ein Ratespiel mit Nachkommastellen.

**Die Aussage der Tabelle ist das Verhältnis, nicht der Absolutwert.** Die
Bremswege in `surfaces` sind Größenordnungen und heißen auf der Seite auch so.
Belastbar ist, dass ein Teppich etwa zehnmal länger bremst als eine Fliese –
und dass die Kraft dadurch auf ein Zehntel sinkt. `verify:instruments` prüft
genau diese Proportionalität und die Reihenfolge der Liste.

**Niemand wird aufgefordert, sein Telefon fallen zu lassen.** Der Hinweis
steht über dem Knopf, nicht darunter. Das Werkzeug funktioniert mit einem Klaps
auf den Tisch.

**Die Kurve wird an React vorbei gezeichnet.** Der Schrieb ändert sich
sechzigmal je Sekunde; über `useState` rechnete React sechzigmal je Sekunde
einen Baum durch, um ein `d`-Attribut zu setzen. Der Pfad wird direkt am
Element gesetzt, React erfährt nur die Ergebnisse. Dieselbe Überlegung
begrenzt den Ablesewert des Stethoskops auf sechs Aktualisierungen je Sekunde.

**Mikrofon und Sensor werden freigegeben.** Beide Werkzeuge räumen beim
Verlassen der Seite auf (`stopRef` im Aufräumer). Ein Mikrofon, das nach dem
Wegklicken weiterläuft, ist ein Fehler mit Kameralampe.

### Recht auf Reparatur (`/ersatzteile`)

Seit dem 20. Juni 2025 gilt die Ökodesign-Verordnung (EU) 2023/1670. Sie
verpflichtet Hersteller, Ersatzteile sieben Jahre lang bereitzuhalten –
ausdrücklich auch für Betriebe, die nicht zum Hersteller gehören. Das ist die
rechtliche Grundlage dafür, dass es diese Werkstatt geben darf, und praktisch
keine schreibt es auf ihre Seite.

**Die Einschränkung steht zuerst, nicht im Kleingedruckten.** Die Verordnung
gilt nur für Geräte, die ab dem Stichtag in Verkehr gebracht wurden – derzeit
**null von 25** Modellen des eigenen Katalogs. Wer das verschweigt, verkauft
einem Kunden einen Anspruch, den er nicht hat. Der Abschnitt beginnt deshalb
mit der Frage, ob sie für dieses Gerät greift, und zeigt bei „nein" die
Rechte, die ohnehin gelten (Gewährleistung, Beweislastumkehr, Updatepflicht
nach BGB – jeweils mit Paragraf, damit man nachschlagen kann).

**Es gibt keine ausgerechneten Enddaten.** Die sieben Jahre laufen ab dem
Ende des Inverkehrbringens, nicht ab dem Erscheinen – wann ein Hersteller ein
Modell aus dem Verkauf nimmt, weiß heute niemand. Aus dem Erscheinungsjahr
folgt deshalb nur eine **Untergrenze**, und sie heißt auf der Seite auch so.
Ein Datum, das nach Auskunft aussieht und geraten ist, wäre genau die Sorte
Genauigkeit, die dieses Projekt sonst vermeidet.

**Das Erscheinen ist eine Näherung für das Inverkehrbringen**, und das steht
dabei. Bei Modellen aus dem Jahr des Stichtags kann es im Einzelfall anders
liegen; `verify:support` prüft die Stichtagslogik deshalb auf den Tag genau
und in beide Richtungen.

**Es ist eine Zusammenfassung, keine Rechtsberatung.** Der Satz steht unter
dem Abschnitt, zusammen mit der Fundstelle bei EUR-Lex – das Prüfskript
verlangt, dass die Quelle dorthin zeigt und nicht auf eine Sekundärseite.

### Drosselschreiber und Pixel-Wecker

Die beiden einzigen Werkzeuge des Projekts, die **keine einzige Berechtigung**
brauchen: kein Mikrofon, kein Sensor, keine Kamera. Nur Rechnen und Licht.

**Der Drosselschreiber kalibriert sich auf das Gerät.** Ein festes
Arbeitspaket wäre auf einem neuen Telefon in zwei Millisekunden erledigt und
auf einem sechs Jahre alten in zweihundert – die Kurven ließen sich nicht
nebeneinanderlegen. Gesucht wird deshalb erst die Menge, die auf diesem Gerät
etwa `TARGET_MS` dauert; verglichen wird danach nur mit dem eigenen
Anfangswert.

**Auf dem Hauptstrang, nicht in einem Worker.** Ein Worker liefe womöglich auf
einem der absichtlich langsamen Sparkerne, auf die das Betriebssystem
Hintergrundarbeit gern schiebt – gemessen würde dann die Zuteilung statt der
Drosselung. Der Hauptstrang ist außerdem der, dessen Tempo ein Mensch spürt.

**Das Ergebnis der Schleife wird verwendet.** Eine Rechnung, deren Ergebnis
niemand liest, darf ein optimierender Übersetzer vollständig streichen – und
dann misst man das Nichts. `Math.imul` ist Pflicht: Ohne sie rechnet die
Maschine in Gleitkomma, und das Ergebnis läuft auseinander.

**Über dem Dreifachen ist es keine Drosselung mehr.** Thermische Drosselung
landet zwischen dem 1,1- und dem 2-fachen. Wird die Arbeit dreimal so langsam,
lief etwas anderes mit. Die Grenze zu ziehen ist kein Schönreden, sondern das
Gegenteil: Ohne sie behauptete die Seite, ein überlastetes Gerät habe ein
Wärmeproblem – eine Diagnose aus einer Störung. Beim Selbsttest im Container
kamen 16-fache Werte heraus, und genau dort greift die Stufe.

**Ein Wechsel in den Hintergrund bricht ab.** Browser bremsen
Hintergrund-Tabs absichtlich und hart. Wer wegwechselt, misst diese Bremse –
deshalb endet die Messung mit einer Erklärung statt mit einer Zahl.

**Der Pixel-Wecker flackert klein, und das ist die bessere Umsetzung.** Alle
verbreiteten Werkzeuge dieser Art lassen den ganzen Bildschirm blinken. Das
hilft nicht mehr – bewegt werden muss der eine hängende Bildpunkt – und
großflächiges Flackern zwischen etwa 3 und 50 Hz ist genau das Reizmuster,
das bei photosensibler Epilepsie Anfälle auslöst. WCAG erlaubt schnelles
Flackern ausdrücklich nur auf kleiner Fläche. Das verschiebbare Feld ist
also nicht die vorsichtige Notlösung, sondern die richtige.

**Gestartet wird erst nach einer ausdrücklichen Bestätigung**, und der Hinweis
steht über dem Knopf. Dieselbe Regel wie beim Sturzschreiber: Wo ein Werkzeug
ein Risiko trägt, steht der Satz davor, nicht danach.

**Hängend ist nicht defekt.** Der Unterschied steht gleich groß daneben: Ein
hängender Punkt leuchtet farbig und lässt sich manchmal lösen, ein defekter
bleibt schwarz und niemals. Versprochen wird nichts – ein Werkzeug, das
Heilung zusagt, wäre hier fehl am Platz.

### Klirrfaktor und Spannungslinse

Zwei Ergänzungen zu den Instrumenten, beide nach derselben Regel gebaut: Die
Zahl ist gerechnet, das Bild ist ein Bild, und wo etwas nicht messbar ist,
steht ein Strich.

**Der Klirrfaktor misst eine Rampe, keinen Wert.** Ein einzelner Wert wäre
wertlos – er hängt am Raum, am Abstand, am Mikrofon. Aussagekräftig ist der
Verlauf über fünf Lautstärkestufen: Ein gesunder Lautsprecher bleibt lange
flach und klirrt erst kurz unter Vollaussteuerung, ein beschädigter klirrt von
der ersten Stufe an. Deshalb steht dort auch kein Grenzwert; „unter 1 % ist
gut" gilt für einen Messplatz, nicht für ein Telefon auf dem Küchentisch.

**Ohne verwertbare Grundwelle wird nichts angezeigt.** Der Klirrfaktor teilt
die Oberwellen durch die Grundwelle; ist die nur Rauschen, teilt man Rauschen
durch Rauschen. Im Test kamen dabei 550 % heraus – eine Zahl, die nicht bloß
falsch ist, sondern auch noch nach Befund aussieht. Jede Stufe wird deshalb
einzeln gegen `USABLE_AMPLITUDE` geprüft.

**`amplitudeAt` summiert die Leistung, es liest nicht den stärksten Bin.** Ein
Ton liegt fast nie genau auf einem Bin, und die Fensterfunktion verschmiert
ihn zusätzlich über mehrere. Die erste Fassung las nur das Maximum und maß
gegen eine Datei mit exakt 5,00 % zweiter Oberwelle nur 4,58 % ab; mit der
Leistungssumme trifft dieselbe Messung auf zwei Nachkommastellen.
`verify:instruments` prüft das mit einer künstlich über fünf Bins verteilten
Linie – wer zurück auf das Maximum baut, bekommt 0,68 statt 1,00 gemeldet.

**Die Spannungslinse rechnet nach Inglis (1913).** σ = σ₀ · (1 + 2 · √(a / ρ))
beantwortet die Frage „ist doch nur ein Kratzer" mit einer Zahl: 50 µm tief
und 0,5 µm scharf ergeben die einundzwanzigfache Spannung an der Spitze. Die
Formel ist eine Idealisierung (elliptisches Loch, unendliche Platte,
gleichmäßiger Zug), und das steht auf der Seite dabei – ihre Aussage, dass
die Schärfe mehr zählt als die Tiefe, gilt auch in der modernen Rechnung mit
Spannungsintensitätsfaktoren.

**Das Bild dazu ist ein Schema und sagt das.** Die Kraftlinien zeigen, dass
sich der Fluss vor der Spitze staut, nicht wie stark. Eine echte
Spannungsverteilung wäre eine Finite-Elemente-Rechnung; sie zu behaupten wäre
dieselbe Sorte gefälschter Genauigkeit, die auf derselben Seite schon beim
PWM-Diagramm vermieden wird.

**Die Schieber laufen logarithmisch, und der für die Schärfe ist umgedreht.**
Linear läge der ganze interessante Bereich in den ersten zwei Prozent des
Wegs. Und weil „schärfer" der kleinere Radius ist, läuft dieser Schieber
rückwärts: Ein Regler, der nach rechts weniger bedeutet, wird falsch bedient.
`verify:instruments` prüft außerdem, dass jedes Beispiel innerhalb der
Schieberwege liegt – das flachste lag zuerst darunter und hätte beim Antippen
etwas anderes angezeigt, als der Knopf verspricht.

### Das Reparaturzertifikat (`/pruefen`, `/intern/zertifikat`)

Der Grund, warum es das gibt: Jeder Betrieb dieser Branche schreibt „geprüfte
Qualität" auf seine Rechnung, und niemand kann es nachprüfen. Ein Protokoll,
das der Aussteller jederzeit umschreiben kann, belegt nichts – es behauptet
etwas mit Briefkopf. Hier wird das Prüfprotokoll nach der Reparatur
**kryptografisch unterschrieben**; der Kunde nimmt es als QR-Code mit und kann
Jahre später nachrechnen, dass daran kein Bit geändert wurde. Auch von uns
nicht.

**Was der Beleg beweist, steht neben dem, was er nicht beweist.** Eine
Signatur zeigt Unversehrtheit und Herkunft – nicht Sorgfalt. Der Abschnitt
„Was er nicht beweist" auf `/pruefen` ist gleich groß gesetzt wie der andere
und nennt auch die Grenze des Vertrauensankers: Wer die Domain kontrolliert,
kontrolliert den Schlüsselring. Wer hier etwas hinzufügt, prüft, ob der
zweite Abschnitt mitwächst.

**ECDSA P-256, nicht Ed25519.** Die modernere Kurve wäre in jedem Vortrag die
richtige Antwort und ist hier die falsche: Geprüft wird auf dem Gerät des
Kunden, oft auf genau dem Telefon, das gerade repariert wurde. `Ed25519` kam
in WebCrypto erst mit Safari 17, Firefox 129 und Chrome 137. P-256 ist seit
2014 überall, gilt unverändert als sicher und liefert dieselbe
Signaturlänge – 64 Byte, roh als r‖s, nicht DER-verpackt.

**Der Beleg muss in einen QR-Code auf Thermopapier passen.** Deshalb ein
Binärformat statt JSON: rund 120 Byte, base64url ~160 Zeichen, mit Adresse
davor QR-Version 9–11. Die Längengrenzen der Textfelder in `encodeSignable`
(Modell 32, Charge 24, Kürzel 12 Byte) sind daraus **gerechnet**, nicht
gegriffen; `verify:cert` rechnet den schlimmsten Fall nach und bricht ab
Version 12 ab.

**Die Modellbezeichnung steht als Text im Beleg, nicht als Index.** Ein Index
in `lib/data/devices.ts` wäre zwei Byte kürzer und eine Zeitbombe: Wird ein
Modell aus dem Katalog genommen, zeigten alle alten Zertifikate auf ein
anderes Gerät. Ein Beleg, dessen Bedeutung sich mit dem nächsten Deploy
ändert, ist keiner. Dasselbe gilt für `CERT_REPAIRS` – die Reihenfolge ist
eingefroren, neue Arten kommen hinten an.

**Die Gerätebindung hat vier Byte, und mehr wäre schlechter.** Im Zertifikat
steht nicht die IMEI, sondern der Anfang ihres SHA-256-Werts; die Prüfseite
fragt die Nummer beim Kunden ab. Die Länge ist in beide Richtungen begrenzt:
Vier Byte lassen ein fremdes Zertifikat nur mit 1 : 4,3 Milliarden zufällig
passen – und auf denselben Wert fallen rund 23 000 der ~10¹⁴ möglichen
IMEIs, sodass sich aus einem abfotografierten Bon keine Nummer zurückrechnen
lässt. Mit fünf Byte wären es 90 Kandidaten, mit sechs genau einer.

**Der Code steht im Fragment der Adresse**, nicht in einem Parameter. Ein
Fragment schickt der Browser niemals an einen Server – der Beleg landet in
keinem Zugriffsprotokoll, auch nicht in dem des Hosters.

**Der Schlüsselring in `lib/cert/keys.ts` ist leer und wird vom Betrieb
gefüllt.** Die private Hälfte darf niemand gesehen haben, der nicht in der
Werkstatt sitzt – ein Schlüssel aus einem fremden Rechner beweist nichts über
den Betrieb. Solange der Ring leer ist, meldet `/pruefen` jeden Beleg als
„Schlüssel nicht hinterlegt"; ein Schlüssel, den nur der ausstellende Browser
kennt, wird ausdrücklich als **Einrichtungsmodus** benannt und nicht als
gültig verkauft. Ein Schlüssel wird nie ersetzt, nur ergänzt und mit `until`
versehen: Alte Belege müssen prüfbar bleiben.

**Die Sicherungsdatei gehört niemals in dieses Repository.** Sie enthält
beide Hälften und sieht der Zeile, die nach `keys.ts` gehört, zum
Verwechseln ähnlich – oben `{ "id": 1, "privateJwk": { … } }`, unten
`{ id: 1, publicKey: "…", since: "…", note: "…" },`. Genau diese
Verwechslung ist am 8.8.2026 passiert: Der Inhalt der Sicherung landete im
Dokumentationskommentar über `certKeys`, mit dem privaten Skalar, in einem
öffentlichen Repository. Zugleich stand die öffentliche Zeile in einem
zweiten Kommentar – der Ring war also leer und sah eingerichtet aus.

Der Fehler war nicht schwer zu finden, sondern schwer zu **bemerken**:
Alles übersetzte, alle Prüfskripte liefen durch, `/pruefen` verhielt sich
wie vor der Einrichtung. Seitdem durchsucht `verify:cert` den ganzen
Quelltext nach privatem Schlüsselmaterial und schlägt an, wenn in
`keys.ts` ein öffentlicher Schlüssel steht, der nicht im Array ist.

Ein so offengelegter Schlüssel ist verbrannt. Er wird **nicht** in den Ring
eingetragen – ein Eintrag würde die Fälschungen derer beglaubigen, die den
privaten Teil aus der Historie lesen. Er wird ersetzt, und da noch kein
Beleg mit ihm im Umlauf ist, bleibt die Liste einfach leer.

**Das Siegel trägt einen Ton, nicht zwei.** Der erste Entwurf zeichnete die
Hüllkurve grün und die Speichen blau – das sah nach Ampel aus. Ein gültiges
Zertifikat ist der Normalfall und kein Erfolg; den Befund trägt der Satz
daneben. Die zweite Linie der Figur bleibt deshalb überall graphitgrau und
sagt nichts.

**Das Signaturbild ist die Signatur**, nicht ihr Hash: 64 Speichen, eine je
Byte, Länge gleich Wert. Es ist eine Lesehilfe und für sich **kein
Prüfmerkmal** – es zu fälschen ist trivial. Deshalb steht es nie ohne den
Befund daneben. Die Kurzform (`fingerprint`) nutzt dasselbe Alphabet ohne
I, O, 0 und 1 wie der Vorgangscode.

**`verify:cert` kippt jedes einzelne Bit** des unterschriebenen Datensatzes
und verlangt, dass die Signatur jedes Mal bricht. Nicht eine Stichprobe: Läge
irgendwo ein Bit, das die Signatur nicht abdeckt, wäre genau dort die Stelle
zum Fälschen. Das Skript hat sich beim ersten Lauf selbst überführt – es
meldete eine schwache Kurzform, obwohl der Fehler in seinen eigenen
Testdaten saß (eine Folge, die sich alle 256 Durchgänge wiederholte).

### Der Offline-Vorrat (`/notfall`)

Auf /notfall steht die wichtigste Zusage dieser Website – die Seite
funktioniert ohne Netz – und zugleich die einzige, die niemand glauben kann:
Man merkt es erst, wenn es zu spät ist, sie zu prüfen. Deshalb steht dort
jetzt ein Kassensturz aus dem echten Browserspeicher: Welche Seiten liegen
gerade auf diesem Gerät, wie groß sind sie, und was fehlt.

**Die Vorratsliste steht zweimal und wird verglichen.** Ein Service Worker
ist eine eigenständige Datei ohne Zugriff auf das Modulsystem, also gibt es
die Liste in `public/sw.js` und in `lib/pwa/precache.ts`. Der Prüfstand
vergleicht beide zeichen- und reihenfolgengenau, dazu die als unverzichtbar
markierten Seiten und den Namen der Nachricht. Zwei Fassungen derselben
Liste driften sonst auseinander, und dann zeigt /notfall einen Vorrat an, den
es nicht gibt – ausgerechnet dem, der ihn braucht.

**Nachlegen macht der Worker, nicht die Seite.** Der erste Entwurf rief die
fehlenden Adressen mit `fetch` ab und verließ sich darauf, dass der Worker
sie unterwegs mitnimmt. Er tut es nicht: Sein Handler legt HTML nur bei
`request.mode === "navigate"` ab, und ein `fetch` aus einem Skript ist keine
Navigation. Der Knopf lief ins Leere, ohne dass etwas fehlschlug. Jetzt geht
die Bitte per `postMessage` an den Worker und die Antwort über einen
MessagePort zurück.

**`precache()` gibt sein Ergebnis zurück.** `Promise.allSettled` sorgt dafür,
dass ein einzelner Fehlschlag die Installation nicht mitnimmt – richtig so.
Es sorgte aber auch dafür, dass die Funktion selbst dann erfüllt zurückkam,
wenn kein einziger Abruf geklappt hatte; der Knopf meldete daraufhin Erfolg
und hatte nichts getan. Wer den Ausgang nicht weitergibt, kann ihn nicht
melden. Fehlgeschlagene Adressen stehen jetzt namentlich auf der Seite.

**Die Größe kommt erst auf Knopfdruck.** Die Byte-Zahl steht in keinem
Verzeichnis; sie entsteht, indem jede gespeicherte Antwort einmal gelesen
wird. Das ist Arbeit, die niemand bestellt hat, wenn er die Seite bloß
aufruft.

### Der Fingerabdruck-Nachweis (`/datenschutz`)

Eine Datenschutzerklärung ist der am wenigsten gelesene Text jeder Website,
weil sie nur behaupten kann. Oben auf dieser steht deshalb ein Abschnitt, der
zeigt statt behauptet: Auf Knopfdruck liest er aus, was der Browser jeder
Website ungefragt herausgibt – Bildschirm, Zeitzone, Grafikchip, installierte
Schriften, eine Canvas-Signatur – und stellt daneben den Satz, auf den es
ankommt: Nichts davon wird gesendet, gespeichert oder gezählt.

**Der Abschnitt steht vor der Erklärung, nicht als Anhang.** Wer nach dem
dritten Absatz aufhört zu lesen, soll wenigstens diesen gesehen haben.

**Gelesen wird erst auf Knopfdruck.** Beim bloßen Aufrufen der Seite passiert
nichts – ein Abschnitt über Datensparsamkeit, der beim Laden schon zugreift,
wäre die Pointe gegen sich selbst. Aus demselben Grund wird jeder gelesene
Wert auch angezeigt; `verify:privacy` prüft, dass die Anzeige über
`signals.map` läuft und nicht über eine Auswahl.

**Keine Angabe darf um Erlaubnis fragen.** Das ist der Kern der Aussage: Ein
Wert, für den der Browser einen Dialog zeigt, gehört nicht in diese Liste –
er wäre der Gegenbeweis statt des Beweises. Das Prüfskript liest deshalb den
Quelltext jeder Lesefunktion und schlägt bei `getUserMedia`, `geolocation`,
`requestPermission` und Verwandten an.

**Die eine Zahl, die fehlen muss.** „Sie sind einer von 3 Millionen" wäre der
stärkste Effekt und die einzige Angabe, die diese Seite nicht haben darf: Für
sie müsste man Besucher miteinander vergleichen, also genau die Sammlung
anlegen, deren Fehlen hier der Punkt ist. Stattdessen der Beweis, den jeder
selbst führen kann – noch einmal drücken, derselbe Wert. `verify:privacy`
schlägt an, wenn im Quelltext eine Häufigkeit auftaucht.

**Die Zusage wird im Quelltext geprüft, nicht zugesagt.** Die beteiligten
Dateien dürfen kein `fetch`, kein `sendBeacon`, kein `XMLHttpRequest`, keinen
`localStorage`, kein `new Image()` und keinen dynamischen Import enthalten.
Ein „nur zum Zählen" eingebautes `fetch" fiele sonst niemandem auf –
Fingerabdruckdaten sehen im Netzwerkfenster aus wie jede andere Anfrage. Wer
eine weitere Datei anlegt, die diese Werte liest, trägt sie in `GUARDED` ein.

### Zwei Regeln, die über der Optik stehen

**Nichts behaupten, was nicht stimmt.** Die Werkzeuge hier rechnen, statt zu
raten, und legen offen, wie sie rechnen – der Ankaufsrechner zeigt jeden
Abzug einzeln, der Akku-Coach nennt seine Konstanten, die IMEI-Prüfung zeigt
die Luhn-Rechnung. Wo etwas geschätzt ist, steht „Schätzung" dabei; wo etwas
veranschaulicht ist (Farbdrift im Display-Vergleich), steht das ebenfalls
dabei. Kein erfundener Countdown, keine erfundenen Marktpreise, keine
Hersteller-Zuordnung aus einer IMEI. Lieber eine Lücke als eine Behauptung.

Ein Sonderfall davon, weil er beim Weiterbauen so verlockend ist: **Die
PWM-Darstellung auf `/ersatzteile` ist ein Zeitdiagramm und bleibt eines.**
Der naheliegende „Verbesserung" wäre, beide Panels verlangsamt blinken zu
lassen – und sie dreht die Aussage um. 3.000 Hz haben die kürzere Periode als
240 Hz; in gleichmäßiger Zeitlupe blinkt also das gute Panel schneller und
wirkt unruhiger. Der Betrachter lernte das Gegenteil der Wirklichkeit.
Deshalb steht dort ein Ausschnitt von zehn Millisekunden auf einer Zeitachse,
und die entscheidende Zahl – die Länge einer einzelnen Dunkelphase – steht als
Zahl dabei, nicht als Effekt.

**Der Notfall hat Vorrang vor allem.** `/notfall` muss ohne JavaScript, ohne
Netz und auf jedem Gerät funktionieren. Deshalb stehen dort alle vier
Protokolle vollständig im HTML statt hinter einem Umschalter, und deshalb
steht die Seite an erster Stelle im Precache des Service Workers. Wer daran
etwas ändert, prüft beides.

### Übergabe-Assistent (`/vorbereitung`)

Beantwortet, was vor einer Abgabe zu erledigen ist – und grenzt sich damit
bewusst von `/ticket` ab: Das Ticket **protokolliert** am Tresen, dass Backup
und Gerätesuche erledigt sind, diese Seite erklärt zu Hause das **Wie**.

- **Jeder Schritt nennt seine Folge** (`ifSkipped` in `lib/data/handover.ts`).
  Nicht „bitte erledigen", sondern was konkret entfällt. Neue Schritte ohne
  diese Angabe sind unvollständig.
- **Menüpfade sind Beispiele, keine Zusicherung.** Apple und die
  Android-Hersteller benennen Menüs um; wo ein Pfad veralten kann, steht das
  dabei, statt eine Genauigkeit zu behaupten, die niemand pflegt.
- **Der Sperrcode ist eine Abwägung, keine Aufforderung.** Für alle drei Wege
  steht, welche Prüfungen möglich bleiben (`covered`) und welche entfallen
  (`notCovered`). Die Werkstatt hat ein Interesse am bequemsten Weg – das ist
  kein Grund, die anderen schlechtzureden. Wer hier etwas ändert, prüft, dass
  `notCovered` weiterhin vollständig ist.
- **Keine Markdown-Syntax in den Textwerten.** Die Strings werden direkt
  gerendert; `**fett**` erscheint wörtlich auf der Seite. Betonung gehört in
  die Formulierung.
- Der Fortschritt steht in der Adresse (`?p=ios&ok=backup.lock&c=muendlich`) –
  nichts Persönliches, kein Speicher, teilbar wie das Ticket.

### Personenbezogene Daten

Es gibt keine Datenbank und keine Konten. Was ein Besucher eingibt, bleibt im
Arbeitsspeicher seines Tabs – auch die IMEI im Übergabeprotokoll, das
ausdrücklich nicht in localStorage geschrieben wird. Verlassen darf es das
Gerät nur, wenn er selbst eine Anfrage absendet. Der Zustand des
Reparatur-Tickets steht bewusst lesbar in der Adresse (Gerät und Reparaturen,
nichts Persönliches). Wer hier etwas ergänzt, zieht `app/datenschutz` mit.

### Die Absenderegel: erst zustimmen, dann senden

**Kein Auftrag und keine Anfrage verlässt das Gerät ohne zwei bewusste
Handlungen** – Haken an der Datenschutzerklärung, danach Druck auf „Senden".
Das gilt für jeden Weg nach draußen, gleich ob Server, E-Mail-Entwurf oder
WhatsApp. Der Haken ist nie vorausgewählt; ohne ihn passiert beim Drücken
nichts außer einer Erklärung.

Die Regel wohnt in **`components/ui/ConsentGate.tsx`**, nicht im Markup der
einzelnen Formulare. Eine neue Absendestelle bindet beides ein:

```tsx
const consent = useConsentGate();
…
<ConsentGate {...consent.gate} channel="mail" />   // oder channel="whatsapp"
<button {...consent.sendProps()} type="submit">Anfrage senden</button>
```

und als erste Zeile im Absendepfad `if (!consent.allow()) return;`. Dort sitzt
die Sperre – `sendProps` liefert nur die Optik (`data-consent-pending`, siehe
globals.css) und den Satz für die Vorlesehilfe.

Zurzeit gilt sie an fünf Stellen: Kontaktformular, Sofortpreis-Rechner
(Terminanfrage), Ankaufsrechner, WhatsApp-Anfrage im Reparatur-Ticket und die
Anmeldung eines Vorgangs (`components/ticket/TicketRegistration.tsx`).
Nackte `mailto:`-Verweise ohne vorausgefüllte Angaben (Footer, Impressum,
„Teileliste senden") fallen nicht darunter: Dort schreibt der Besucher seine
Nachricht selbst, die Seite überträgt nichts.

Drei Dinge, die dabei leicht kaputtgehen:

- **Kein `disabled` und kein `aria-disabled` an der Absende-Schaltfläche.**
  Beides hieße „nicht bedienbar" – der Druck ist hier aber der Weg zur
  Erklärung. `disabled` nimmt den Knopf zusätzlich aus der Tabulatorreihenfolge.
- **Die Nutzlast gehört nicht ins `href`.** Ein `<a href="…?text=…">` ließe
  sich per mittlerer Maustaste, „In neuem Tab öffnen" oder „Link kopieren" an
  jeder Prüfung im JavaScript vorbeitragen. Absendestellen sind Knöpfe; die
  Adresse entsteht erst nach `allow()`.
- **Serverseitig zweite Prüfung.** `app/api/kontakt/route.ts` verlangt die
  Zustimmung ein weiteres Mal. Was nur im Browser geprüft wird, ist nicht
  geprüft.

Wer daran etwas ändert, zieht `app/datenschutz` mit – dort steht die Regel
als Zusage an den Kunden, samt Ziel der Anfrage (das Google-Postfach des
Betriebs) und Widerrufsmöglichkeit.

### Offene Punkte vor dem Livegang

- **Signaturschlüssel neu erzeugen und veröffentlichen:** `/intern/zertifikat`
  öffnen, Schlüssel erzeugen, die Sicherungsdatei außerhalb des Browsers
  verwahren und die angezeigte Zeile – **nur diese Zeile** – in das Array
  `certKeys` in `lib/cert/keys.ts` übernehmen. Bis dahin kann niemand
  außerhalb dieses einen Browsers ein Zertifikat prüfen.

  **Dringend:** Der am 8.8.2026 erzeugte Schlüssel #1 ist offengelegt (siehe
  „Das Reparaturzertifikat"). Der im Browser gespeicherte Schlüssel ist über
  „Schlüssel erzeugen" zu ersetzen; die alte Sicherungsdatei ist zu löschen.
  Solange das nicht geschehen ist, unterschreibt der Werkstattrechner mit
  einem Schlüssel, dessen private Hälfte öffentlich in der Git-Historie
  steht.
- **Bankverbindung eintragen:** Das Rechnungswerkzeug startet ohne IBAN, BIC und
  Steuernummer – beim ersten Start unter „Stammdaten" hinterlegen, sonst bleibt
  der GiroCode aus und die Rechnung ist unvollständig.
- **Garantiedauer prüfen:** `site.warrantyMonths` steht auf `12`. FAQ,
  Ersatzteil-Seite und Metadaten nannten zuvor teils 24 Monate. Der Wert ist
  jetzt an einer Stelle gepflegt – dort den tatsächlich zugesagten Zeitraum
  eintragen.
- **Kennzahlen bestätigen:** „45 Min durchschnittlicher Displaytausch" und die
  Angaben im Konfigurator sind betriebliche Zusagen und sollten stimmen.
- Adresse, Telefon, USt-IdNr. und Preise in `lib/site.ts` bzw.
  `lib/data/devices.ts` gegenprüfen.
