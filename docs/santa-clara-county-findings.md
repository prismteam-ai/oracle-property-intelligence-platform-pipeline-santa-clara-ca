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

## Appraisal (bounded 5-parcel GIS path)

**Extension point:** bundled `elephant-county` still only registers `ADAPTERS.pinellas` and `ADAPTERS.duval` (`bin/elephant-county.mjs`). `ingest --county santa-clara` remains **Unknown --county**. Restate `Parcel.process` is not this runtime’s entrypoint. Assessor Real Property Search is ASP.NET/terms-gated and has no documented anonymous GET print URL.

**Smallest path implemented (assignment repo, reuse runtime engines):** CountyAdapter verbs in `counties/santa-clara/` plus CommonJS `transforms/data_extractor.js`. Capture is Socrata `ubcd-cewv` JSON (plain GET; query stays in `multiValueQueryString`). Transform writes `data/property.json` + `data/parcel.json` (+ address/lot). `runCountyTransform`, zip, and query-table Parquet come from the bundled runtime — no second ingestion stack.

**Reproducible bounded replay/test:** `node --test tests/santa-clara-ingest.test.mjs`. The assignment-local adapter is exercised directly against the committed replay fixture while official `elephant-county --county santa-clara` registration remains pending.

**Sample (fixture replay, 2026-09-29):** 5/5 verified APNs `09201021`, `14810022`, `09234015`, `10417087`, `09206033` → structural `validateRun` valid, internal query table 5/5. GIS does not carry use codes, owners, or assessed values.

### Live elephant-cli proof (five GIS samples, 2026-09-30)

Not mocked. Manifest loaded from `https://lexicon.elephant.xyz/api/manifest` (GitHub elephant-cli; published npm 1.58.1 still points at a dead HTML `json-schemas` URL).

| Item | Value |
| --- | --- |
| CLI package version | 1.58.1 |
| Installed commit | `44bb182b9f7f904662e9b33e1fde70bdeab62322` (`github:elephant-xyz/elephant-cli` via `tools/package.json`) |
| Manifest URL | `https://lexicon.elephant.xyz/api/manifest` |
| Gateway used | `--ipfs-gateway https://gateway.pinata.cloud,https://ipfs.filebase.io,https://trustless-gateway.link` |
| County schema CID | `bafkreia6tjziby3upxmidymud5iusd32urrztslgrudkwysc7ydmxoekuq` |
| Seed schema CID | `bafkreibhurphpjdq33ysit57jtzmdldgngepsdbsw4vm7esawth2ezgaxu` |
| One-sample validate (`09201021`) | exit 0, 0 error rows |
| Five-sample validate (`data/runs/lexicon-five/samples`) | 5 succeeded, 0 failed, 0 error rows |
| Hash | 5 properties × 2 data groups (10 `hash.csv` rows); hashed zips under `data/runs/lexicon-five/hashed.zip/` |
| CAR | `data/runs/lexicon-five/sample-county.car` — 52 blocks, root `baguqeeraj3dsxub2hqv4cajxe4cutkj52xduyhkgksoi42vxnpq3k6itcw3q` |
| CAR validate | exit 0; 5 properties; 10 data groups; 0 integrity/root/index/graph/lexicon/orphan errors |
| export-tables | 9 tables, 9 parts, tables root `baguqeeraws47c27kuk72me6medpqqjkwys52ypgucszdlihxfldcvbxshskq` |

Exported row counts (5 each): `properties`, `property`, `address`, `parcel`, `lot`, `property_has_address`, `property_has_parcel`, `property_has_lot`, `address_has_parcel`.

GIS extras that the live class schemas reject (`additionalProperties: false`, no `source_payload` on property/parcel/lot/address) are **not** stored on those records: `objectid`, `tax_rate_area`, `jurisdiction`, `number_of_situs_address`, `shape_length`, raw `shape_area`, situs street number/direction/name/type/unit. Mapped at five-sample time: APN, unnormalized situs, county name, city/state/ZIP, and (then) `lot_area_sqft` from rounded `shape_area`. `property_type` is `LandParcel` (GIS cadastral polygon class; **not** an Assessor use code). Deprecated Seed relationship `property_seed` was omitted so export-tables would not collide with class `property_seed`. The five-sample CAR/tables under `data/runs/lexicon-five/` were left in place after the later `shape_area` unit audit.

### `shape_area` units (authoritative metadata)

Socrata dataset `ubcd-cewv` column `Shape_Area` (`https://data.sccgov.org/api/views/ubcd-cewv.json`) has **empty `format` and no unit/description**. Dataset page column list also has no unit.

Linked ArcGIS layer `https://maps.santaclaracounty.gov/server/rest/services/property/SCCProperty/MapServer/0` (`metadata.arcgis_connection` on the Socrata view) documents **`geometryProperties.units`: `esriMeters`**, `mapUnits.uwkid` **9001**, spatial reference **WKID 102100 / 3857** (Web Mercator). That is the published **geometry** linear unit, not a documented unit on the stored `Shape_Area` attribute (field alias only; no domain). Attribute magnitudes on typical city lots look like US square feet, which conflicts with treating Web Mercator square meters as the attribute unit.

**Conclusion:** stored `shape_area` units are **not proven**. `lot_area_sqft` is now always `null` (schema allows null). No conversion is applied.

### Coverage sample (16 GIS records, 2026-09-30)

Row-shape variability only (no invented use categories). Captures, CARs, and CLI CSVs stay under gitignored `data/runs/lexicon-coverage/` (five-sample run dir untouched).

| APN | Jurisdiction | Why included |
| --- | --- | --- |
| 09201021 | SAN JOSE | Identifier-proven baseline |
| 14810022 | PALO ALTO | Identifier-proven |
| 09234015 | UNINCORPORATED | Identifier-proven unincorporated |
| 10417087 | SUNNYVALE | Identifier-proven |
| 09206033 | MILPITAS | Identifier-proven; `number_of_situs_address`=6 |
| 08624063 | MILPITAS | `number_of_situs_address`=287; large polygon |
| 09202001 | SAN JOSE | `situs_unit_number` present |
| 09206032 | SAN JOSE | Missing house number |
| 09238058 | SAN JOSE | No situs fields (`number_of_situs_address`=0) |
| 07006045 | UNINCORPORATED | Missing `situs_city_name`; 2 situs |
| 62707015 | UNINCORPORATED | Very large `Shape_Area`; 47 situs |
| 26417108 | SAN JOSE | Tiny `Shape_Area`; no situs |
| 78322021 | Gilroy | Mixed-case jurisdiction |
| 27913032 | CAMPBELL | Incorporated Campbell |
| 19711032 | MOUNTAIN VIEW | Incorporated Mountain View |
| 10113001 | SANTA CLARA | Santa Clara city |

**Field inventory (capture `$select` vs transform):** every sample’s GIS JSON keys were diffed against `data/*.json`. No class-(a) extractor bugs. Class-(b) not fetched: `the_geom`, `reserved1`, `reserved2`, `reserved3`. Class-(c) present on the capture with no live class home (`additionalProperties: false`, no `source_payload`): `objectid`, `tax_rate_area`, `jurisdiction`, `number_of_situs_address`, `shape_length`, `shape_area`, situs house/suffix/direction/name/type/unit. Mapped when present: `apn`; assembled unnormalized situs; `situs_city_name` → `city_name`; ZIP → postal/plus-four; `situs_state_code` or default `CA`. Blank GIS address parts stay blank/`null` (two samples have `unnormalized_address` null). Per-sample JSON: `data/runs/lexicon-coverage/coverage-inventory.json`.

**Source cannot supply:** Assessor use codes, ownership, assessed/market/land values, legal description, proven lot area/units, lot type/fencing/driveway, `property_usage_type`. `property_type` remains GIS `LandParcel`, not an Assessor class.

**Live CLI (same pin/manifest as five-sample):** validate 16/16, 0 error rows; hash 32 rows (16× Seed `bafkreibhurphpjdq33ysit57jtzmdldgngepsdbsw4vm7esawth2ezgaxu` + County `bafkreia6tjziby3upxmidymud5iusd32urrztslgrudkwysc7ydmxoekuq` from live manifest); CAR 162 blocks, 16 properties, 32 data groups, all checks 0 errors, root `baguqeeraxqgttyhimrxkmrxuictjvzqctau6z3oz6hizzl2bdoe4h7liko5q`; export-tables 9 tables × **16 rows**, tables root `baguqeerasylgnu2dz5i5ytvsacw22vfgjufn6fsg6pd7oblgoq4ihdemwlda`. Tables match emitted classes/relationships: `properties`, `property`, `address`, `parcel`, `lot`, `property_has_address`, `property_has_parcel`, `property_has_lot`, `address_has_parcel`.

CLI `unknown format "percentage"` lines are lexicon schema warnings on unused tax paths, not data rows.

Earlier automation could not complete Assessor Search (disabled control). Operator manual Search-by-APN succeeded for the five IDs above.

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
