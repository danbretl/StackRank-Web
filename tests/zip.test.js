import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, concatBytes, dosDateTime, createStoredZipBlob } from "../lib/zip.js";

const enc = (s) => new TextEncoder().encode(s);

// A small, self-contained reader for stored (method 0) ZIPs — enough to verify
// the archives createStoredZipBlob emits are structurally valid and round-trip,
// without shelling out to `unzip`. Parses the End Of Central Directory, walks the
// central directory, then reads each local entry and checks its CRC.
function readStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => view.getUint16(o, true);
  const u32 = (o) => view.getUint32(o, true);

  // Find EOCD (0x06054b50) scanning from the end (no trailing comment expected).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (u32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert.notEqual(eocd, -1, "EOCD record present");
  const totalEntries = u16(eocd + 10);
  const centralSize = u32(eocd + 12);
  const centralStart = u32(eocd + 16);
  assert.equal(centralStart + centralSize, eocd, "central directory abuts EOCD");

  const entries = [];
  let p = centralStart;
  for (let n = 0; n < totalEntries; n += 1) {
    assert.equal(u32(p), 0x02014b50, "central dir header signature");
    const crc = u32(p + 16);
    const compSize = u32(p + 20);
    const uncompSize = u32(p + 24);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOffset = u32(p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(compSize, uncompSize, "stored: comp == uncomp size");

    // Read the matching local file header + data.
    assert.equal(u32(localOffset), 0x04034b50, "local file header signature");
    const lNameLen = u16(localOffset + 26);
    const lExtraLen = u16(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(dataStart, dataStart + uncompSize);
    assert.equal(crc32(data) >>> 0, crc >>> 0, `CRC matches for ${name}`);

    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { totalEntries, entries };
}

async function zipBytes(files) {
  const blob = createStoredZipBlob(files);
  assert.equal(blob.type, "application/zip");
  return new Uint8Array(await blob.arrayBuffer());
}

test("crc32 matches known check vectors", () => {
  assert.equal(crc32(enc("")) >>> 0, 0x00000000);
  // The canonical CRC-32 check value for the ASCII string "123456789".
  assert.equal(crc32(enc("123456789")) >>> 0, 0xcbf43926);
  assert.equal(crc32(enc("The quick brown fox jumps over the lazy dog")) >>> 0, 0x414fa339);
});

test("crc32 is order-sensitive and length-sensitive", () => {
  assert.notEqual(crc32(enc("ab")), crc32(enc("ba")));
  assert.notEqual(crc32(enc("a")), crc32(enc("aa")));
});

test("concatBytes joins in order with correct length", () => {
  const out = concatBytes([new Uint8Array([1, 2]), new Uint8Array([]), new Uint8Array([3])]);
  assert.deepEqual([...out], [1, 2, 3]);
  assert.equal(concatBytes([]).length, 0);
});

test("dosDateTime packs into two 16-bit fields", () => {
  const { time, date } = dosDateTime(new Date(2026, 5, 26, 13, 30, 44));
  assert.ok(time >= 0 && time <= 0xffff);
  assert.ok(date >= 0 && date <= 0xffff);
  // Date field: ((year-1980)<<9) | (month<<5) | day = (46<<9)|(6<<5)|26.
  assert.equal(date, (46 << 9) | (6 << 5) | 26);
});

test("createStoredZipBlob emits a valid, complete archive", async () => {
  const files = [
    { name: "a.txt", bytes: enc("hello world") },
    { name: "nested/b.svg", bytes: enc("<svg>x</svg>") },
  ];
  const bytes = await zipBytes(files);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'starts with "PK\\x03\\x04"');
  const { totalEntries, entries } = readStoredZip(bytes);
  assert.equal(totalEntries, 2);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["a.txt", "nested/b.svg"],
  );
});

test("archive round-trips binary and UTF-8 content exactly", async () => {
  const binary = new Uint8Array([0, 1, 2, 255, 254, 0x50, 0x4b, 0x05, 0x06]); // includes EOCD-looking bytes
  const unicode = enc("packs · ünïcödé 🎬");
  const bytes = await zipBytes([
    { name: "data.bin", bytes: binary },
    { name: "ünïcödé.txt", bytes: unicode },
  ]);
  const { entries } = readStoredZip(bytes);
  assert.deepEqual([...entries[0].data], [...binary], "binary payload preserved byte-for-byte");
  assert.deepEqual([...entries[1].data], [...unicode], "utf-8 payload preserved");
  assert.equal(entries[1].name, "ünïcödé.txt", "utf-8 filename preserved");
});

test("empty file set yields an archive with zero entries", async () => {
  const bytes = await zipBytes([]);
  const { totalEntries } = readStoredZip(bytes);
  assert.equal(totalEntries, 0);
});

test("a single file produces exactly one entry", async () => {
  const bytes = await zipBytes([{ name: "only.png", bytes: enc("x") }]);
  const { totalEntries, entries } = readStoredZip(bytes);
  assert.equal(totalEntries, 1);
  assert.equal(entries[0].name, "only.png");
});
