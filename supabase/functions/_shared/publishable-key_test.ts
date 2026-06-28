import {
  isPublishableKeyAllowed,
  parsePublishableKeys,
} from "./publishable-key.ts";

Deno.test("parsePublishableKeys returns named configured keys", () => {
  const keys = parsePublishableKeys(
    JSON.stringify({
      default: "sb_publishable_default",
      web: "sb_publishable_web",
    }),
  );

  if (keys.length !== 2 || !keys.includes("sb_publishable_default") || !keys.includes("sb_publishable_web")) {
    throw new Error(`Unexpected parsed keys: ${JSON.stringify(keys)}`);
  }
});

Deno.test("parsePublishableKeys rejects missing and malformed configuration", () => {
  for (const raw of [undefined, "", "not-json", "[]", "null"]) {
    if (parsePublishableKeys(raw).length !== 0) {
      throw new Error(`Expected no keys for ${String(raw)}`);
    }
  }
});

Deno.test("isPublishableKeyAllowed requires an exact configured key", () => {
  const keys = ["sb_publishable_default"];
  if (!isPublishableKeyAllowed("sb_publishable_default", keys)) {
    throw new Error("Configured key should be accepted");
  }
  if (isPublishableKeyAllowed("sb_publishable_other", keys)) {
    throw new Error("Unknown key should be rejected");
  }
  if (isPublishableKeyAllowed(null, keys)) {
    throw new Error("Missing key should be rejected");
  }
});
