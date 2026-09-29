# Santa Clara County, CA — discovery findings

**Slug:** `santa-clara` · **FIPS:** `06085` · **Job:** `santa-clara-onboard-2026-09-29`
**Ingest plan:** pilot ~25 parcels after readiness PASS, then full run.
**Catalog:** `docs/santa-clara-sources.yaml`

## Intake (locked 2026-09-29)

- Canonical seed for this **public-data candidate run:** county GIS parcel layer `ubcd-cewv` under an approved parcel exception. Paid Assessor AMF is **out of scope** (not purchased). GIS is not complete assessed coverage.
- Permits: all **15 cities + unincorporated**.
- Identity: **CA SOS BizFile** (entity) then **CSLB** (license). Permit names/license numbers are search keys only.
- Browser/Playwright allowed; **no** CAPTCHA/Cloudflare/login/terms bypass.
- Publication credentials: **not set**. Continue non-publish work.
- Runtime: existing `elephant-county` local path. **No second orchestrator. No Docker** unless a later stage requires it.
- Node: **v22.20.0** at `~/.local/node-v22.20.0-darwin-arm64/bin/node` (npm 10.9.3).

## Paid Assessor AMF (documented, not the candidate-run seed)

The candidate-run seed is the **public GIS parcel layer**, under the approved parcel exception. The Secured Assessment Roll / Secured Master File is a **paid Assessor product that was not purchased** and is out of scope for this public-data run.

Official bulk path is a **paid Data File Order**, not an open download:

- Order page: [sccassessor.org/about-us/purchase-data/bulk-data](https://www.sccassessor.org/about-us/purchase-data/bulk-data)
- Office: Standards and Services Division, 70 West Hedding St., East Wing 5th Floor, San Jose, CA 95110 · 408-299-5500 · fax 408-298-9446
- Form evidence (IS Order Form 01/26/2021, effective 7/1/2020): ASCII files; email or CD; annual lien-date (Jan 1) files typically mid-July.
- **MF901B** Secured Master File without Use Codes: **$495.00**
- **MF901** Secured Master File with Use Codes: **$2,485.00** (Use Code not normally on the public roll)
- AMF described as **~458,000** APN-sorted records (owner, land/improvement values, TRA, billing name, document numbers).
- Individual online lookup is free; **resale prohibited**; assessee name omitted online (Gov. Code 6254.21 / R&T 408.3).
- **This candidate run will not purchase the AMF.** Public-data scope only. The paid file remains documented, not acquired.

## GIS seed backbone (approved exception)

- [data.sccgov.org Parcels ubcd-cewv](https://data.sccgov.org/Government/Parcels/ubcd-cewv): **504,717** features (`$select=count(*)`).
- County disclaimer: GIS is not official records; air vs land polygons exist.
- Catalog `approved_exceptions` entry `gate: parcel` records why AMF is unavailable, the ~10.2% literature gap vs 458000, that GIS is seed-not-complete-coverage, missing/extra populations, coverage impact, and APN/geometry provenance.
- Validator result: parcel **APPROVED_EXCEPTION**, overall **PASS**, `execution_allowed` / `seed_allowed` **true**.
- Counterfactual: filling `assessed_parcel_count: 458000` with the same exception would make parcel **PASS** (silent), which is why the acquired assessed count is left empty.

## Seed (public GIS, not assessed-roll completeness)

Built with `scripts/build-santa-clara-gis-seed.mjs` from Socrata `ubcd-cewv` (retrieved 2026-09-29T22:09:26Z).

| Check | Result |
| --- | --- |
| GIS features fetched | 504,717 |
| Invalid / missing APN (excluded from seed) | 9,876 |
| Duplicate non-empty APN | 0 |
| Seed rows (`parcel_id` present, unique, 8-digit text) | **494,841** |
| Runtime CSV parse | 494,841 rows, 0 empty ids, 0 duplicate ids |

Source of truth: `data/seeds/santa-clara.csv` (gitignored, 121MB) plus `data/seeds/santa-clara-seed-manifest.json`. Staged copy only: bundled runtime `data/seeds/santa-clara.csv`. Full polygons stay in GIS; seed keeps `geometry_join_key` (OBJECTID), shape metrics, dataset URL, retrieve timestamp.

## Identifier proof (operator manual, 2026-09-29)

Five seed APNs were entered **undashed** in [Assessor Real Property Search](https://www.sccassessor.org/apps/realpropertysearch.aspx?cob=true). All five returned live records. Portal displayed dashed 3-2-3 APNs. Situs matched the seed street/city; ZIP punctuation differed only. `09206033` has multiple Assessor situs rows; the seed address is one of them.

| Seed APN | Assessor display | Situs |
| --- | --- | --- |
| 09201021 | 092-01-021 | 1902 N CAPITOL AV SAN JOSE |
| 14810022 | 148-10-022 | 4386 MILLER CT PALO ALTO |
| 09234015 | 092-34-015 | 2048 OLD PIEDMONT RD SAN JOSE |
| 10417087 | 104-17-087 | 1386 SANDIA AV SUNNYVALE |
| 09206033 | 092-06-033 | 777 N CAPITOL AV MILPITAS |

`parcel.identifier_proven` is **true** on that bounded sample only, not a claim that every seed row was looked up.

## Appraisal smoke (stopped before adapter)

`elephant-county ingest --county santa-clara` → **Unknown --county "santa-clara". Known counties: pinellas, duval**. No Santa Clara adapter, flow, or transform in the bundled runtime. Restate `Parcel.process` is not this runtime’s entrypoint.

Earlier automation could not complete Search (disabled control). Operator manual Search-by-APN succeeded for the five IDs above.

## Permits (classified, adapters not started)

Live check: unincorporated Accela **CapHome Development** search is public (parcel + address, no login). `portal_kind` is **application-intake**, so `historical_records` stays **false** (not complete countywide/municipal history).

| Jurisdiction | Vendor | Public URL | historical_records |
| --- | --- | --- | --- |
| unincorporated | Accela `sccgov` | aca-prod.accela.com/sccgov | false |
| Campbell | MyGovernmentOnline | mygovernmentonline.org | false |
| Cupertino | Accela `CUPERTINO` | aca-prod.accela.com/CUPERTINO | true (lookup; Laserfiche extra) |
| Gilroy | Tyler EnerGov GO Permit | gilroyca-energovweb.tylerhost.net | false (post-2023-06-19) |
| Los Altos | CentralSquare eTRAKiT | trakit.losaltosca.gov | true |
| Los Altos Hills | CentralSquare eTRAKiT | trakit.losaltoshills.ca.gov | true |
| Los Gatos | Accela `TLG` | aca-prod.accela.com/TLG | true |
| Milpitas | eTRAKiT | trakit.ci.milpitas.ca.gov | true |
| Monte Sereno | custom epermits | epermits.montesereno.org | false |
| Morgan Hill | eTRAKiT / aspgov | morg-trk.aspgov.com | true |
| Mountain View | custom epermits | epermits.mountainview.gov | false (2000+ online; older in person) |
| Palo Alto | Permit View (+ Accela PALOALTO) | paloalto.gov Permit View page | true |
| San Jose | sjpermits | sjpermits.org | true |
| Santa Clara city | Accela `SANTACLARA` | aca-prod.accela.com/SANTACLARA | true |
| Saratoga | CentralSquare eTRAKiT | sara.csqrcloud.com | false (account-oriented) |
| Sunnyvale | iWorQ / E-OneStop | sunnyvalepermits.portal.iworq.net | false (split around 2024-10-07) |

`assumes_unified_countywide_history` remains **false**. No harvester code added.

## Identity

Reuse the official-identity **stage**, not a new product: SOS BizFile then CSLB license-detail. Bundled runtime still only has Florida Sunbiz/DBPR modules — **gap called, not forked**.

## Destination

Local Postgres 16.15 is running as the internal Query DB (not Docker). Proof did **not** use seed data.

Independent identity sources that matched:

1. Cluster: data directory `~/.local/elephant-query-db-pgdata`, system identifier `7691080307121495675`, PG 16.15.
2. Configured endpoint in the gitignored runtime `.env`: host `127.0.0.1`, port `5432`, database `elephant`, user `postgres`.

Node `pg` client `SELECT` against that database succeeded. Password and full `DATABASE_URL` are not recorded here.

## Publication access you will need (no secrets in git)

Before Atlas publication (`use-oracle` / `car-publication.md`):

1. **Node 22.18+** (done) and **elephant-cli** capable of validate / hash CAR / validate CAR / export-tables `--atlas-page` / upload.
2. **Public IPFS upload node** that stays reachable through Atlas merge. Worked example is **Filebase Kubo RPC** (API key + endpoint stored only in env, never committed). A laptop Kubo is not enough unless it remains publicly reachable.
3. **Authenticated GitHub** (`gh auth`) with permission to open a PR on **`elephant-xyz/atlas`** (`counties/CA/santa-clara.json` only). **Code-owner merge** — do not self-merge.
4. After merge: verify global Atlas IPNS `k51qzi5uqu5dhzmj1jtn06idud425ozwdjjjn4eu7q01g2t814h7rw4du0nd04`, then `npx -y @elephant-xyz/mcp@2 sync`.

Not required until that stage: Filebase, Atlas rights, MCP token.

## Bootstrap

- Node **22.20.0** is on login PATH via `~/.zshrc` and `~/.zprofile`.
- Bundled runtime `npm ci` completed.
- Local Postgres 16.15 Query DB destination proven (see Destination). Docker not used.
- Do **not** scaffold Restate compose; bundled runtime is `elephant-county.mjs`.

## Readiness

`overall` PASS with parcel **APPROVED_EXCEPTION**. Destination PASS. Permit PASS. GIS is the public seed backbone under that exception, not assessed completeness. Adapters not started. Paid AMF remains out of scope.
