import fs from "node:fs/promises";

// Portrait expansion is additive. A changed encoder or master must never silently
// replace a previously reviewed file; check mode must not repair missing output.
export async function preserveDogArtwork(filename, bytes, { checkOnly = false } = {}) {
  const existing = await fs.readFile(filename).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (existing && !existing.equals(bytes)) throw new Error(`Refusing to overwrite an existing portrait variant: ${filename}`);
  if (existing) return "unchanged";
  if (checkOnly) throw new Error(`Missing portrait variant: ${filename}`);
  await fs.writeFile(filename, bytes, { flag: "wx" });
  return "created";
}
