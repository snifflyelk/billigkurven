# Billigkurven MVP

Moderne matpris-webapp bygget med Next.js 14, TypeScript, Tailwind CSS, Prisma og PostgreSQL.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Zod validering
- TanStack Query
- Recharts

## Funksjoner

- Onboarding med brukerpreferanser
- Handleliste med sok, legg til/fjern og mengde-endring
- Butikksammenligning med billigste butikk og estimert besparelse
- Produktside med pris pa tvers av butikker, pris per enhet og dummy-prishistorikk
- Adminpanel for enkel produkt- og pris-CRUD

## API-endepunkter

- /api/products/search
- /api/products/[id]
- /api/shopping-list
- /api/shopping-list/items
- /api/compare
- /api/alerts
- /api/alerts/[id]
- /api/coverage
- /api/products/[id]/timing
- /api/user/preferences
- /api/admin/products
- /api/admin/prices

## Kom i gang

1. Installer avhengigheter:

```bash
npm install
```

2. Sett opp database-URL-er i .env (lokal PostgreSQL eller Supabase):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/billigkurven?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/billigkurven?schema=public"
```

Eksempel med Supabase:

```env
# Pooler URL (brukes av app/runtime)
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

# Direct URL (brukes av Prisma migrate/db push)
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require"
```

3. Generer Prisma-klient:

```bash
npm run prisma:generate
```

4. Opprett database-skjema:

```bash
npm run prisma:migrate -- --name init
```

Hvis du kobler til eksisterende Supabase-prosjekt og vil synke skjema raskt uten lokal migrasjonshistorikk, kan du bruke:

```bash
npx prisma db push
```

5. Seed dummy-data:

```bash
npm run prisma:seed
```

6. Start appen:

```bash
npm run dev
```

## Dummy-data i seed

- 30 produkter
- 5 butikker
- 300 prislinjer
- 3 brukere
- 3 handlelister

## Live prishistorikk (Supabase)

For a bygge historiske prisserier over tid kan du kjore live-sync jevnlig:

```bash
npm run prices:sync
```

Nyttige miljo-variabler for sync:

```env
LIVE_PRICING_MAX_PRODUCTS=80
LIVE_PRICING_MIN_INTERVAL_HOURS=6
NORGESGRUPPEN_MENY_GLN=1300010110113
NORGESGRUPPEN_SPAR_GLN=1210010110111
NORGESGRUPPEN_JOKER_GLN=1220010110110
LIVE_PRICING_GLN_SCAN_LIMIT=30
LIVE_PRICING_GLN_SCAN_SPAN=80
ALERTS_TO_EMAIL=
ALERT_COOLDOWN_HOURS=18
ALERT_FROM_EMAIL=alerts@billigkurven.local
ALERT_SMTP_HOST=
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=
ALERT_SMTP_PASS=
WEEKLY_REPORT_DAY=MONDAY
WEEKLY_REPORT_HOUR=8
WEEKLY_REPORT_CRON_SECRET=
```

Se status pa volum og kilder i databasen:

```bash
npm run prices:stats
```

Finn/bekreft fungerende GLN-kandidater for MENY/SPAR/Joker:

```bash
npm run prices:gln:bootstrap
```

Kjor daglig datakvalitetsaudit (sjekker outliers og mistenkelige matcher):

```bash
npm run prices:quality:audit
```

Registrer timesync i Windows Task Scheduler:

```bash
npm run prices:schedule:windows
```

Registrer daglig data-quality task i Windows Task Scheduler:

```bash
npm run prices:quality:schedule:windows
```

Kjor daglig prisvarsel-jobb (sender e-post via SMTP hvis konfigurert, ellers logger fallback til `logs/alert-events.log`):

```bash
npm run alerts:run
```

Registrer daglig varsel-task i Windows Task Scheduler:

```bash
npm run alerts:schedule:windows
```

Kjor ukentlig rapport-jobb manuelt (epost fallback til logg hvis SMTP mangler):

```bash
npm run weekly-report:run
```

Registrer ukentlig rapport-task i Windows Task Scheduler:

```bash
npm run weekly-report:schedule:windows
```

Kall scheduler-endepunkt fra cron/job runner:

```bash
POST /api/savings/weekly-report/schedule
Header: x-weekly-report-secret: <WEEKLY_REPORT_CRON_SECRET>
Body: { "force": false, "channel": "email" }
```

Coverage API kan filtreres med postnummer:

```bash
GET /api/coverage?postalCode=0451
GET /api/coverage?postalPrefix=04
```

Produkt-timing (best buy window):

```bash
GET /api/products/<product-id>/timing
```
