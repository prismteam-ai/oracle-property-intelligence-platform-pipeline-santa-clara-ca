import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  toSocrataCaptureUrl,
  SOCRATA_RESOURCE_URL,
  SAMPLE_PARCEL_IDS,
  defaultRuntimeRoot,
} from "../counties/santa-clara/seed.mjs";
import {
  assertGisMatchesRequestedApn,
  buildSourceHttpRequest,
  captureAndTransform,
  validateRun,
  hasCompletedTransform,
} from "../counties/santa-clara/adapter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = path.join(ROOT, "fixtures", "santa-clara-replay");
const HTML_DIR = path.join(FIXTURE_DIR, "html");

test("Socrata capture URL keeps resource path query-free in source_http_request.url", () => {
  const request = buildSourceHttpRequest({
    parcel_id: "09201021",
    url: SOCRATA_RESOURCE_URL,
    method: "GET",
    multiValueQueryString: JSON.stringify({ $where: ["apn='09201021'"], $limit: ["1"] }),
  });
  assert.equal(request.url, SOCRATA_RESOURCE_URL);
  assert.equal(request.multiValueQueryString.$where[0], "apn='09201021'");
  const captureUrl = toSocrataCaptureUrl({
    parcel_id: "09201021",
    url: SOCRATA_RESOURCE_URL,
    multiValueQueryString: JSON.stringify(request.multiValueQueryString),
  });
  assert.match(captureUrl, /ubcd-cewv\.json/);
  assert.match(captureUrl, /apn%3D%2709201021%27|apn='09201021'/);
});

test("GIS capture fails closed on APN mismatch", () => {
  assert.throws(
    () => assertGisMatchesRequestedApn(JSON.stringify([{ apn: "00000000" }]), "09201021"),
    /does not match requested/,
  );
});

test("missing fixture without --live-fetch fails closed", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "scc-nofixture-"));
  try {
    const manifest = await captureAndTransform({
      seedRows: [{ parcel_id: "09999999" }],
      htmlDir: HTML_DIR,
      outputDir,
      liveFetch: false,
    });
    assert.equal(manifest.results[0].transformSuccess, false);
    assert.match(manifest.results[0].error, /refusing to contact Socrata/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("five verified APNs transform to property.json + parcel.json zips", async () => {
  const runtimeRoot = defaultRuntimeRoot();
  const { parseCsvRecords } = await import(`file://${runtimeRoot}/src/core/csv.mjs`);
  const seedRows = parseCsvRecords(await readFile(path.join(FIXTURE_DIR, "seed.csv"), "utf8"));
  assert.equal(seedRows.length, 5);
  assert.deepEqual(
    seedRows.map((row) => row.parcel_id).sort(),
    [...SAMPLE_PARCEL_IDS].sort(),
  );

  const outputDir = await mkdtemp(path.join(tmpdir(), "scc-ingest-"));
  try {
    const manifest = await captureAndTransform({
      seedRows,
      htmlDir: HTML_DIR,
      outputDir,
      liveFetch: false,
      runtimeRoot,
    });
    const validation = await validateRun(manifest, { runtimeRoot });
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    assert.equal(validation.checked, 5);
    for (const row of seedRows) {
      assert.equal(await hasCompletedTransform(path.join(outputDir, row.parcel_id)), true);
      const property = JSON.parse(
        await readFile(path.join(outputDir, row.parcel_id, "data", "property.json"), "utf8"),
      );
      assert.equal(property.parcel_identifier, row.parcel_id);
      assert.equal(property.source_http_request.url, SOCRATA_RESOURCE_URL);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("transform does not write property.json when GIS JSON is empty", async () => {
  const runtimeRoot = defaultRuntimeRoot();
  const htmlDir = await mkdtemp(path.join(tmpdir(), "scc-empty-html-"));
  const outputDir = await mkdtemp(path.join(tmpdir(), "scc-empty-out-"));
  try {
    await writeFile(path.join(htmlDir, "09201021.html"), "[]\n");
    const manifest = await captureAndTransform({
      seedRows: [{ parcel_id: "09201021", situs_address: "x" }],
      htmlDir,
      outputDir,
      liveFetch: false,
      runtimeRoot,
    });
    assert.equal(manifest.results[0].transformSuccess, false);
    assert.match(manifest.results[0].error, /empty|does not match/i);
  } finally {
    await rm(htmlDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
});
