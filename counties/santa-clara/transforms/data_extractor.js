const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const WORKING_DIR = process.cwd();
const DATA_DIR = path.join(WORKING_DIR, "data");
const MANIFEST_URL = process.env.ELEPHANT_SCHEMA_MANIFEST_URL || "https://lexicon.elephant.xyz/api/manifest";

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(WORKING_DIR, fileName), "utf8"));
}

function writeData(fileName, record) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, fileName), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function fetchJson(url) {
  const body = execFileSync("curl", ["-fsS", "--max-time", "60", url], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(body);
}

function loadGisRecord() {
  const raw = fs.readFileSync(path.join(WORKING_DIR, "input.html"), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Santa Clara GIS capture is not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!record || typeof record !== "object") {
    throw new Error("Santa Clara GIS capture is empty");
  }
  return record;
}

function cleanSourceHttpRequest(sourceHttpRequest) {
  if (!sourceHttpRequest || typeof sourceHttpRequest !== "object") {
    throw new Error("property_seed.json is missing source_http_request");
  }
  const cleaned = {
    method: sourceHttpRequest.method || "GET",
    url: sourceHttpRequest.url,
  };
  if (sourceHttpRequest.multiValueQueryString) {
    cleaned.multiValueQueryString = sourceHttpRequest.multiValueQueryString;
  }
  return cleaned;
}

function text(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function rel(fromFile, toFile) {
  return { from: { "/": `./${fromFile}` }, to: { "/": `./${toFile}` } };
}

function link(fileName) {
  return { "/": `./${fileName}` };
}

const gis = loadGisRecord();
const propertySeed = readJson("property_seed.json");
const unnormalizedAddress = readJson("unnormalized_address.json");
const apn = String(gis.apn ?? "").trim();
const seedApn = String(propertySeed.parcel_id ?? "").trim();
if (!apn) throw new Error("GIS record is missing apn");
if (apn !== seedApn) {
  throw new Error(`GIS apn ${apn} does not match seed parcel_id ${seedApn}`);
}

const sourceHttpRequest = cleanSourceHttpRequest(propertySeed.source_http_request);
const requestIdentifier = propertySeed.request_identifier || apn;

const manifest = fetchJson(MANIFEST_URL);
if (!manifest?.County?.ipfsCid || !manifest?.Seed?.ipfsCid) {
  throw new Error(`Live lexicon manifest at ${MANIFEST_URL} is missing County/Seed data-group CIDs`);
}
const countyGroupCid = manifest.County.ipfsCid;
const seedGroupCid = manifest.Seed.ipfsCid;

// GIS extras with no live class property (additionalProperties: false, no
// source_payload on property/parcel/lot/address): objectid, tax_rate_area,
// jurisdiction, number_of_situs_address, shape_length, shape_area,
// situs_house_number(_suffix), situs_street_direction/name/type, situs_unit_number.
// City/state/ZIP map onto the Address unnormalized branch.
// Do not map shape_area to lot_area_sqft: Socrata column metadata has no unit;
// ArcGIS SCCProperty/0 geometryProperties.units is esriMeters (wkid 9001) for
// the published Web Mercator geometry, which does not prove the stored
// Shape_Area attribute unit. Do not invent Assessor use codes, owners, or values.

const zipRaw = text(gis.situs_zip_code);
let postalCode = zipRaw;
let plusFour = null;
if (zipRaw && /^\d{5}-\d{4}$/.test(zipRaw)) {
  postalCode = zipRaw.slice(0, 5);
  plusFour = zipRaw.slice(6);
}

// Live property class requires property_type (string enum, not null) and forbids
// source_payload. GIS does not publish Assessor use/ownership/value. LandParcel
// is the cadastral-parcel class for this GIS polygon, not an Assessor use code.
writeData("property.json", {
  parcel_identifier: apn,
  property_legal_description_text: null,
  property_type: "LandParcel",
  source_http_request: sourceHttpRequest,
  request_identifier: requestIdentifier,
});

writeData("parcel.json", {
  parcel_identifier: apn,
  source_http_request: sourceHttpRequest,
  request_identifier: requestIdentifier,
});

// Address oneOf unnormalized branch. Seed address_has_parcel.from is Address, not
// UnnormalizedAddress. Do not mix full_address / county_jurisdiction here.
writeData("address.json", {
  source_http_request: sourceHttpRequest,
  request_identifier: requestIdentifier,
  unnormalized_address: text(unnormalizedAddress.full_address),
  county_name: "Santa Clara",
  city_name: text(gis.situs_city_name),
  postal_code: postalCode,
  plus_four_postal_code: plusFour,
  state_code: text(gis.situs_state_code) || "CA",
});

writeData("lot.json", {
  source_http_request: sourceHttpRequest,
  request_identifier: requestIdentifier,
  lot_type: null,
  lot_length_feet: null,
  lot_width_feet: null,
  lot_area_sqft: null,
  landscaping_features: null,
  view: null,
  fencing_type: null,
  fence_height: null,
  fence_length: null,
  driveway_material: null,
  driveway_condition: null,
  lot_condition_issues: null,
});

writeData("relationship_property_address.json", rel("property.json", "address.json"));
writeData("relationship_property_parcel.json", rel("property.json", "parcel.json"));
writeData("relationship_property_lot.json", rel("property.json", "lot.json"));
writeData("address_has_parcel.json", rel("address.json", "parcel.json"));

writeData(`${countyGroupCid}.json`, {
  label: "County",
  relationships: {
    property_has_address: link("relationship_property_address.json"),
    property_has_parcel: [link("relationship_property_parcel.json")],
    property_has_lot: link("relationship_property_lot.json"),
  },
});

writeData(`${seedGroupCid}.json`, {
  label: "Seed",
  relationships: {
    address_has_parcel: link("address_has_parcel.json"),
  },
});
