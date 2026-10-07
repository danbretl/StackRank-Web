const encoder = new TextEncoder();

// PostgreSQL's jsonb::text uses spaces after separators and expands exponents.
// Measure wire JSON first so toJSON/undefined/NaN match the submitted value.
export function postgresJsonByteLength(value) {
  try {
    const wire = JSON.stringify(value);
    if (typeof wire !== "string") return Infinity;
    const stringBytes = (text) => {
      if (text.includes("\0") || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) return Infinity;
      return encoder.encode(JSON.stringify(text)).length;
    };
    const size = (entry) => {
      if (entry === null) return 4;
      if (typeof entry === "string") return stringBytes(entry);
      if (typeof entry === "boolean") return entry ? 4 : 5;
      if (typeof entry === "number") {
        const text = JSON.stringify(entry);
        if (!text.includes("e")) return text.length;
        const [mantissa, exponentText] = text.split("e");
        const exponent = Number(exponentText);
        const sign = mantissa.startsWith("-") ? 1 : 0;
        const unsigned = mantissa.slice(sign);
        const digits = unsigned.replace(".", "").length;
        const decimalPosition = (unsigned.indexOf(".") < 0 ? unsigned.length : unsigned.indexOf(".")) + exponent;
        return sign + (decimalPosition <= 0 ? 2 - decimalPosition + digits : decimalPosition >= digits ? decimalPosition : digits + 1);
      }
      if (Array.isArray(entry)) return 2 + entry.reduce((total, item) => total + size(item), 0) + Math.max(0, entry.length - 1) * 2;
      const entries = Object.entries(entry);
      return 2 + entries.reduce((total, [key, item]) => total + stringBytes(key) + 2 + size(item), 0) + Math.max(0, entries.length - 1) * 2;
    };
    return size(JSON.parse(wire));
  } catch (_error) {
    return Infinity;
  }
}
