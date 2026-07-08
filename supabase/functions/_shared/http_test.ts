import {
  allowedStackRankOrigin,
  rejectDisallowedBrowserOrigin,
  stackRankCorsHeaders,
  stackRankPreflightResponse,
} from "./http.ts";

Deno.test("allowedStackRankOrigin accepts production, preview, and local development origins", () => {
  const allowed = [
    "https://www.stackrankapp.com",
    "https://stackrankapp.com",
    "https://danbretl.github.io",
    "https://stackrank-git-main-danbretl-2590s-projects.vercel.app",
    "http://localhost:8000",
    "http://127.0.0.1:4321",
    "http://[::1]:8000",
    "http://192.168.4.31:8000",
  ];

  for (const origin of allowed) {
    if (allowedStackRankOrigin(origin) !== origin) {
      throw new Error(`Expected ${origin} to be allowed`);
    }
  }
});

Deno.test("allowedStackRankOrigin rejects unrelated browser origins", () => {
  const rejected = [
    null,
    "not-a-url",
    "https://evil.example",
    "http://stackrankapp.com",
    "https://stackrank-evil.example.vercel.app",
  ];

  for (const origin of rejected) {
    if (allowedStackRankOrigin(origin) !== null) {
      throw new Error(`Expected ${String(origin)} to be rejected`);
    }
  }
});

Deno.test("stackRankCorsHeaders echoes only allowed browser origins", () => {
  const allowedReq = new Request("https://example.test", {
    headers: { Origin: "https://www.stackrankapp.com" },
  });
  const allowedHeaders = stackRankCorsHeaders(allowedReq);
  if (
    allowedHeaders.get("Access-Control-Allow-Origin") !==
      "https://www.stackrankapp.com"
  ) {
    throw new Error("Expected allowed origin to be echoed");
  }
  if (allowedHeaders.get("Vary") !== "Origin") {
    throw new Error("Expected CORS response to vary by Origin");
  }

  const rejectedReq = new Request("https://example.test", {
    headers: { Origin: "https://evil.example" },
  });
  const rejectedHeaders = stackRankCorsHeaders(rejectedReq);
  if (rejectedHeaders.has("Access-Control-Allow-Origin")) {
    throw new Error("Expected rejected origin to receive no CORS allow origin");
  }
});

Deno.test("rejectDisallowedBrowserOrigin keeps no-Origin requests available", () => {
  const curlLikeReq = new Request("https://example.test");
  if (rejectDisallowedBrowserOrigin(curlLikeReq) !== null) {
    throw new Error("Expected request without Origin to pass");
  }

  const blockedReq = new Request("https://example.test", {
    headers: { Origin: "https://evil.example" },
  });
  const response = rejectDisallowedBrowserOrigin(blockedReq);
  if (!response || response.status !== 403) {
    throw new Error(
      `Expected disallowed browser origin to be rejected, got ${response?.status}`,
    );
  }
});

Deno.test("stackRankPreflightResponse mirrors origin decisions", () => {
  const allowedReq = new Request("https://example.test", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:8000" },
  });
  const allowedResponse = stackRankPreflightResponse(allowedReq);
  if (allowedResponse.status !== 200) {
    throw new Error("Expected allowed preflight to pass");
  }
  if (
    allowedResponse.headers.get("Access-Control-Allow-Origin") !==
      "http://localhost:8000"
  ) {
    throw new Error("Expected allowed preflight to echo Origin");
  }

  const rejectedReq = new Request("https://example.test", {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example" },
  });
  const rejectedResponse = stackRankPreflightResponse(rejectedReq);
  if (rejectedResponse.status !== 403) {
    throw new Error("Expected disallowed preflight to be rejected");
  }
  if (rejectedResponse.headers.has("Access-Control-Allow-Origin")) {
    throw new Error(
      "Expected disallowed preflight to receive no CORS allow origin",
    );
  }
});
