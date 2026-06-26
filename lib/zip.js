// Minimal no-dependency ZIP (stored / uncompressed).
//
// Lets the Share Studio image-set exports deliver a single .zip instead of N
// sequential file downloads (which trigger a browser "download multiple files?"
// prompt and land as scattered files). Stored mode (compression method 0) means
// no deflate dependency — just a CRC32 and a handful of fixed headers — which
// keeps us inside the project's no-npm-deps constraint. PNG/SVG cards are a small
// set, so skipping compression costs little.
//
// Pure and DOM-free: `Blob` and `TextEncoder` are globals in browsers and in
// Node, so this module imports cleanly into both the app and the test runner.

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function concatBytes(parts) {
  let length = 0;
  parts.forEach((part) => {
    length += part.length;
  });
  const out = new Uint8Array(length);
  let pos = 0;
  parts.forEach((part) => {
    out.set(part, pos);
    pos += part.length;
  });
  return out;
}

export function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

// files: [{ name: string, bytes: Uint8Array }] → a stored (uncompressed) ZIP Blob.
export function createStoredZipBlob(files) {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();
  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.bytes;
    const crc = crc32(data);
    const localHeader = concatBytes([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed to extract
      u16(0x0800), // general purpose flag: bit 11 = UTF-8 names
      u16(0), // compression method: 0 = stored
      u16(time),
      u16(date),
      u32(crc),
      u32(data.length), // compressed size
      u32(data.length), // uncompressed size
      u16(nameBytes.length),
      u16(0), // extra field length
      nameBytes,
    ]);
    localParts.push(localHeader, data);
    centralParts.push(
      concatBytes([
        u32(0x02014b50), // central directory header signature
        u16(20), // version made by
        u16(20), // version needed
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0), // extra length
        u16(0), // comment length
        u16(0), // disk number start
        u16(0), // internal attributes
        u32(0), // external attributes
        u32(offset), // relative offset of local header
        nameBytes,
      ]),
    );
    offset += localHeader.length + data.length;
  });
  const centralStart = offset;
  let centralSize = 0;
  centralParts.forEach((part) => {
    centralSize += part.length;
  });
  const end = concatBytes([
    u32(0x06054b50), // end of central directory signature
    u16(0), // disk number
    u16(0), // disk with central dir
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(centralStart),
    u16(0), // comment length
  ]);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}
