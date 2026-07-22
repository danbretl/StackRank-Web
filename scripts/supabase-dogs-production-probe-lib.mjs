import { PRODUCTION_PROJECT_REF } from "./supabase-dogs-branch-rehearsal-lib.mjs";

export const PRODUCTION_PROBE_CONFIRMATION =
  "I_AUTHORIZE_BOUNDED_STACKRANK_PRODUCTION_FIXTURES_WITH_CLEANUP";

export const PRODUCTION_PROBE_ENV = Object.freeze({
  projectRef: "STACKRANK_SUPABASE_PRODUCTION_REF",
  supabaseUrl: "STACKRANK_SUPABASE_PRODUCTION_URL",
  publishableKey: "STACKRANK_SUPABASE_PRODUCTION_PUBLISHABLE_KEY",
  secretKey: "STACKRANK_SUPABASE_PRODUCTION_SECRET_KEY",
  confirmation: "STACKRANK_SUPABASE_PRODUCTION_POST_APPLY_CONFIRM",
});

const clean = (value) =>
  typeof value === "string" ? value.trim() : "";

const required = (environment, name) => {
  const value = clean(environment[name]);
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const productionOrigin = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

export const parseProductionPostApplyConfig = (environment = process.env) => {
  const projectRef = required(environment, PRODUCTION_PROBE_ENV.projectRef);
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(`${PRODUCTION_PROBE_ENV.projectRef} must identify Stack Rank production`);
  }
  if (
    required(environment, PRODUCTION_PROBE_ENV.confirmation) !==
    PRODUCTION_PROBE_CONFIRMATION
  ) {
    throw new Error(
      `${PRODUCTION_PROBE_ENV.confirmation} does not match the required production phrase`,
    );
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(required(environment, PRODUCTION_PROBE_ENV.supabaseUrl));
  } catch {
    throw new Error(`${PRODUCTION_PROBE_ENV.supabaseUrl} must be a valid URL`);
  }
  if (
    supabaseUrl.origin !== productionOrigin ||
    supabaseUrl.href !== `${productionOrigin}/` ||
    supabaseUrl.username ||
    supabaseUrl.password ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    throw new Error(
      `${PRODUCTION_PROBE_ENV.supabaseUrl} must be the exact credential-free Stack Rank production origin`,
    );
  }

  const publishableKey = required(
    environment,
    PRODUCTION_PROBE_ENV.publishableKey,
  );
  const secretKey = required(environment, PRODUCTION_PROBE_ENV.secretKey);
  if (publishableKey === secretKey) {
    throw new Error("Production publishable and secret keys must be distinct");
  }

  return Object.freeze({
    expectedRef: projectRef,
    supabaseUrl: supabaseUrl.origin,
    publishableKey,
    secretKey,
  });
};
