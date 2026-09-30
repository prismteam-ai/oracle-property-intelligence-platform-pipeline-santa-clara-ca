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
  buildBulkPageSourceHttpRequest,
} from "../counties/santa-clara/seed.mjs";
import {
  captureSocrataPage,
  indexBulkGisFromPageCapture,
  loadPageCapture,
  sha256Hex,
} from "../counties/santa-clara/page-capture.mjs";
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

test("captured page $offset and $limit survive into entity source_http_request", async () => {
  const runtimeRoot = defaultRuntimeRoot();
  const pageDir = await mkdtemp(path.join(tmpdir(), "scc-page-cap-"));
  const htmlDir = await mkdtemp(path.join(tmpdir(), "scc-bulk-html-"));
  const outputDir = await mkdtemp(path.join(tmpdir(), "scc-bulk-out-"));
  try {
    const records = [
      { apn: "12345678", objectid: "9", situs_city_name: "SAN JOSE", situs_state_code: "CA", situs_zip_code: "95110" },
      { apn: "12345679", objectid: "10", situs_city_name: "SAN JOSE", situs_state_code: "CA", situs_zip_code: "95110" },
    ];
    const raw = Buffer.from(`${JSON.stringify(records)}\n`, "utf8");
    let fetchCalls = 0;
    const captured = await captureSocrataPage({
      offset: 40,
      limit: 2,
      outDir: pageDir,
        fetchImpl: async (url) => {
          fetchCalls += 1;
          const parsed = new URL(String(url));
          assert.equal(parsed.searchParams.get("$offset"), "40");
          assert.equal(parsed.searchParams.get("$limit"), "2");
          assert.equal(parsed.searchParams.get("$order"), "objectid");
          assert.equal(parsed.origin + parsed.pathname, SOCRATA_RESOURCE_URL);
          return {
            ok: true,
            arrayBuffer: async () => raw,
          };
        },
    });
    assert.equal(fetchCalls, 1);
    assert.equal(captured.sha256, sha256Hex(raw));
    const loaded = await loadPageCapture(pageDir);
    assert.equal(loaded.sha256, sha256Hex(await readFile(path.join(pageDir, "page.json"))));
    const bulkGisByApn = indexBulkGisFromPageCapture(loaded);
    const seedRows = [...bulkGisByApn.values()].map((entry) => entry.row);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("offline transform issued GIS HTTP");
    };
    let manifest;
    try {
      manifest = await captureAndTransform({
        seedRows,
        htmlDir,
        outputDir,
        liveFetch: false,
        bulkGisByApn,
        runtimeRoot,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(manifest.results.every((row) => row.transformSuccess), true, JSON.stringify(manifest.results));
    const first = JSON.parse(await readFile(path.join(outputDir, "12345678", "data", "property.json"), "utf8"));
    const second = JSON.parse(await readFile(path.join(outputDir, "12345679", "data", "property.json"), "utf8"));
    const expected = buildBulkPageSourceHttpRequest({ offset: 40, limit: 2 });
    assert.deepEqual(first.source_http_request, expected);
    assert.deepEqual(second.source_http_request, first.source_http_request);
    assert.equal(first.source_http_request.multiValueQueryString.$where, undefined);
    const bulkMeta = JSON.parse(await readFile(path.join(outputDir, "12345678", "bulk_capture.json"), "utf8"));
    assert.equal(bulkMeta.captureSha256, captured.sha256);
    assert.equal(bulkMeta.captureFile, "page.json");
    assert.equal(bulkMeta.pageOffset, "40");
    assert.equal(bulkMeta.pageLimit, "2");
  } finally {
    await rm(pageDir, { recursive: true, force: true });
    await rm(htmlDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("bulk GIS replay fails closed when indexed APN does not match the seed parcel", async () => {
  const runtimeRoot = defaultRuntimeRoot();
  const htmlDir = await mkdtemp(path.join(tmpdir(), "scc-bulk-mismatch-html-"));
  const outputDir = await mkdtemp(path.join(tmpdir(), "scc-bulk-mismatch-out-"));
  try {
    const sourceHttpRequest = buildBulkPageSourceHttpRequest({ offset: 0, limit: 50 });
    const manifest = await captureAndTransform({
      seedRows: [{ parcel_id: "12345678", situs_address: "x" }],
      htmlDir,
      outputDir,
      liveFetch: false,
      bulkGisByApn: new Map([
        [
          "12345678",
          {
            row: {
              parcel_id: "12345678",
              method: sourceHttpRequest.method,
              url: sourceHttpRequest.url,
              multiValueQueryString: JSON.stringify(sourceHttpRequest.multiValueQueryString),
              capture_sha256: "abc",
            },
            gisRecord: { apn: "00000000", objectid: "1" },
            sourceHttpRequest,
            captureSha256: "abc",
            captureFile: "page.json",
            pageOffset: "0",
            pageLimit: "50",
            sourceRetrievedAt: "2026-09-29T18:10:00.000Z",
            sourceDatasetUrl: "https://data.sccgov.org/Government/Parcels/ubcd-cewv",
            captureKind: "socrata_paged_json",
          },
        ],
      ]),
      runtimeRoot,
    });
    assert.equal(manifest.results[0].transformSuccess, false);
    assert.match(manifest.results[0].error, /does not match requested/);
  } finally {
    await rm(htmlDir, { recursive: true, force: true });
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

test("loadPageCapture fails closed when SHA-256 does not match page.json", async () => {
  const pageDir = await mkdtemp(path.join(tmpdir(), "scc-page-digest-"));
  try {
    const records = [{ apn: "12345678", objectid: "1" }];
    const raw = Buffer.from(JSON.stringify(records), "utf8");
    await captureSocrataPage({
      offset: 0,
      limit: 1,
      outDir: pageDir,
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => raw }),
    });
    await writeFile(path.join(pageDir, "page.json"), Buffer.from("[]", "utf8"));
    await assert.rejects(() => loadPageCapture(pageDir), /digest mismatch/);
  } finally {
    await rm(pageDir, { recursive: true, force: true });
  }
});
