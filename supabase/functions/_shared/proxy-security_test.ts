// Synthetic handler tests: no network, environment, database or production access.
// Imports capture Deno.serve; all fetches and environment reads are replaced.
type Handler = (req: Request) => Response | Promise<Response>;
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("Movies proxy input and abuse boundaries with stubbed upstreams", async (t) => {
  const originalServe = Object.getOwnPropertyDescriptor(Deno, "serve")!;
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const upstream: URL[] = [];
  let captured: Handler | undefined;
  Object.defineProperty(Deno, "serve", {
    configurable: true,
    value: (handler: Handler) => {
      captured = handler;
    },
  });
  Deno.env.get = ((key: string) =>
    ({
      SUPABASE_PUBLISHABLE_KEYS: '{"default":"synthetic-publishable"}',
      TMDB_API_KEY: "synthetic-upstream",
    })[key]) as typeof Deno.env.get;
  Date.now = () => 0;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert(
      ["api.themoviedb.org", "image.tmdb.org", "openlibrary.org"].includes(
        url.hostname,
      ),
      "Unexpected upstream host",
    );
    upstream.push(url);
    const movie = {
      id: 1,
      title: "Synthetic movie",
      release_date: "2000-01-01",
      genres: [],
      credits: {},
      runtime: 90,
    };
    return Promise.resolve(
      new Response(JSON.stringify({ ...movie, results: [movie], docs: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  const load = async (name: string) => {
    captured = undefined;
    // A fresh module supplies fresh per-instance buckets for each scenario.
    await import(
      new URL(
        `../${name}/index.ts?security-test=${crypto.randomUUID()}`,
        import.meta.url,
      ).href
    );
    if (!captured) throw new Error(`Missing handler ${name}`);
    return captured as Handler;
  };
  const request = (
    query: string,
    hint?: string,
    extras: Record<string, string> = {},
  ) =>
    new Request(`https://test.invalid/?${query}`, {
      headers: {
        apikey: "synthetic-publishable",
        ...(hint ? { "x-forwarded-for": hint } : {}),
        ...extras,
      },
    });
  try {
    await t.step(
      "recommendation seeds reject traversal, URL syntax, missing and overlong IDs before fetching",
      async () => {
        const handler = await load("tmdb-suggest");
        for (
          const seed of [
            "../../3/tv/1",
            "1?language=xx&",
            "//host.invalid/x",
            "@host.invalid/x",
            "",
            "12345678901",
            "1.5",
            "-1",
            " 1",
            "１",
          ]
        ) {
          const count = upstream.length;
          const response = await handler(
            request(`type=recommendations&seed=${encodeURIComponent(seed)}`),
          );
          assert(
            response.status === 400 && upstream.length === count,
            `Invalid seed reached upstream: ${seed}`,
          );
        }
        const count = upstream.length;
        assert(
          (await handler(request("type=recommendations"))).status === 400 &&
            upstream.length === count,
          "Missing seed must fail",
        );
        assert(
          (await handler(request("type=recommendations&seed=1234567890")))
            .status === 200,
          "Numeric seed should work",
        );
        const sent = upstream.at(-1)!;
        assert(
          sent.origin === "https://api.themoviedb.org" &&
            sent.pathname === "/3/movie/1234567890/recommendations" &&
            sent.searchParams.get("api_key") === "synthetic-upstream",
          "Numeric recommendation URL changed",
        );
        for (const type of ["popular", "trending", "essentials"]) {
          assert(
            (await handler(request(`type=${type}`))).status === 200,
            `Supported ${type} request broke`,
          );
        }
      },
    );
    for (
      const [name, query, limit] of [
        ["tmdb-search", "q=synthetic", 120],
        ["tmdb-detail", "id=1", 120],
        ["tmdb-suggest", "type=recommendations&seed=1", 120],
        ["tmdb-image", "path=/synthetic.jpg", 300],
        ["tonight-pick", "ids=1", 60],
      ] as const
    ) {
      await t.step(
        `${name} limits stable/missing hints and stops upstream work`,
        async () => {
          const handler = await load(name);
          for (let i = 0; i < limit; i++) {
            assert(
              (await handler(request(query))).status === 200,
              `${name} blocked ordinary burst early`,
            );
          }
          const count = upstream.length;
          const denied = await handler(request(query));
          assert(
            denied.status === 429 &&
              Number(denied.headers.get("Retry-After")) > 0 &&
              upstream.length === count,
            `${name} exhausted request reached upstream`,
          );
        },
      );
      await t.step(
        `${name} rotating headers cannot exceed the instance budget`,
        async () => {
          const handler = await load(name);
          for (let i = 0; i < limit * 10; i++) {
            assert(
              (await handler(request(query, `synthetic-${i}`))).status === 200,
              `${name} aggregate budget exhausted early`,
            );
          }
          const count = upstream.length;
          for (const hint of ["fresh-unseen-hint", undefined]) {
            const denied = await handler(request(query, hint));
            assert(
              denied.status === 429 &&
                Number(denied.headers.get("Retry-After")) > 0 &&
                upstream.length === count,
              `${name} rotated/missing hint escaped aggregate budget`,
            );
          }
        },
      );
    }
    await t.step(
      "JSON proxy key/origin/preflight controls and Books quota are preserved",
      async () => {
        for (const name of ["tmdb-search", "tmdb-detail", "tmdb-suggest"]) {
          const handler = await load(name);
          const count = upstream.length;
          assert(
            (await handler(
              request("q=synthetic&id=1", undefined, { apikey: "wrong" }),
            )).status === 401,
            "Key check changed",
          );
          assert(
            (await handler(
              request("q=synthetic&id=1", undefined, {
                Origin: "https://unrelated.invalid",
              }),
            )).status === 403,
            "Origin check changed",
          );
          const preflight = await handler(
            new Request("https://test.invalid", {
              method: "OPTIONS",
              headers: { Origin: "https://www.stackrankapp.com" },
            }),
          );
          assert(
            preflight.ok && upstream.length === count,
            "Preflight/gate reached upstream",
          );
        }
        const books = await load("books-search");
        for (let i = 0; i < 30; i++) {
          assert(
            (await books(request("q=synthetic"))).status === 200,
            "Books burst changed",
          );
        }
        const count = upstream.length;
        assert(
          (await books(request("q=synthetic"))).status === 429 &&
            upstream.length === count,
          "Books quota changed",
        );
      },
    );
  } finally {
    Object.defineProperty(Deno, "serve", originalServe);
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
