/**
 * Santa Clara query-table mapping. Parquet schema is loaded from the
 * bundled Pinellas schema so writeQueryTableParquet stays on the existing path.
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { defaultRuntimeRoot } from "./seed.mjs";

export const SOURCE_SYSTEM = "santa_clara_gis";
export const COUNTY_KEY = "santa-clara";
export const COUNTY_NAME = "Santa Clara";
export const STATE_CODE = "CA";

export function santaClaraPropertyId(parcelId) {
  return createHash("sha256").update(`${SOURCE_SYSTEM}:${parcelId}`).digest("hex").slice(0, 32);
}

function toText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  const parsed = toNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

export async function loadQueryTableSchemaFields(runtimeRoot = defaultRuntimeRoot()) {
  const pinellas = await import(pathToFileURL(path.join(runtimeRoot, "src/counties/pinellas/query-table.mjs")).href);
  return pinellas.QUERY_TABLE_SCHEMA_FIELDS;
}

export async function mapTransformedFilesToQueryTableRow({ parcelId, files, seedRow = null, runtimeRoot = defaultRuntimeRoot() }) {
  const queryTable = await import(pathToFileURL(path.join(runtimeRoot, "src/core/query-table.mjs")).href);
  const address = await import(pathToFileURL(path.join(runtimeRoot, "src/core/address-signature.mjs")).href);
  const roofAge = await import(pathToFileURL(path.join(runtimeRoot, "src/roof-age/integration.ts")).href);
  const property = files["property.json"] ?? {};
  const addressRecord = files["address.json"] ?? {};
  const unnormalized = files["unnormalized_address.json"] ?? {};
  const lot = files["lot.json"] ?? {};
  const situsText =
    toText(unnormalized.full_address) ??
    toText(addressRecord.unnormalized_address) ??
    toText(seedRow?.situs_address);
  const parsed = queryTable.parseUnnormalizedAddress(situsText);
  const addressStreet = parsed.street ?? toText(addressRecord.street_name);
  const addressZip = parsed.postalCode ?? toText(seedRow?.situs_zip_code) ?? toText(addressRecord.postal_code);
  const identity = address.mintSitusAddressIdentity({
    state: STATE_CODE,
    postalCode: addressZip,
    street: addressStreet,
  });
  const lotAreaSqft = toNumber(lot.lot_area_sqft);
  return {
    property_id: santaClaraPropertyId(parcelId),
    property_cid: null,
    request_identifier: parcelId,
    parcel_identifier: toText(property.parcel_identifier) ?? toText(files["parcel.json"]?.parcel_identifier) ?? parcelId,
    source_system: SOURCE_SYSTEM,
    county_name: COUNTY_NAME,
    state_code: STATE_CODE,
    address_street: addressStreet,
    address_city: parsed.city ?? toText(seedRow?.situs_city_name) ?? toText(addressRecord.city),
    address_zip: addressZip,
    elephant_uuid: identity?.elephantUuid ?? null,
    elephant_token: identity?.elephantToken ?? null,
    latitude: toNumber(seedRow?.latitude),
    longitude: toNumber(seedRow?.longitude),
    lot_size_acre: lotAreaSqft !== null ? lotAreaSqft / 43_560 : null,
    lot_area_sqft: lotAreaSqft,
    exterior_wall_material: null,
    roof_covering_material: null,
    ...roofAge.roofAgeQueryFields({}),
    property_type: toText(property.property_type),
    property_usage_type: toText(property.property_usage_type),
    ownership_estate_type: toText(property.ownership_estate_type),
    built_year: toInteger(property.property_structure_built_year),
    livable_floor_area: toNumber(property.livable_floor_area),
    total_area: toNumber(property.total_area),
    assessed_value: null,
    market_value: null,
    land_value: null,
    avm_value: null,
    owner_name: null,
    owners_text: null,
    owner_count: null,
    owner_occupied: null,
    last_sale_date: null,
    last_sale_price: null,
    subdivision: null,
    has_permits: false,
    permit_count: 0,
    has_sunbiz_tenant: false,
    has_bbb_contractor: false,
    hoa_flag: null,
    hoa_cid: null,
    hoa_name: null,
    hoa_sunbiz_document_number: null,
    property_manager_cid: null,
    property_manager_name: null,
    property_manager_sunbiz_document_number: null,
    hoa_pm_status: null,
  };
}
