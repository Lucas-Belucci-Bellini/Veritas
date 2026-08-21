export function isTruthyFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

export function isStrictBetaPreflight(env = {}) {
  const expectedVersion = String(env.BETA_EXPECTED_VERSION ?? env.GITHUB_REF_NAME ?? '')
  return isTruthyFlag(env.BETA_PREFLIGHT_STRICT)
    || isTruthyFlag(env.BETA_PREFLIGHT_REQUIRE_EVIDENCE)
    || /-beta\./i.test(expectedVersion)
}

export function requiredEvidenceFlags(env = {}) {
  const strict = isStrictBetaPreflight(env)
  return {
    strict,
    evidenceManifest: strict || isTruthyFlag(env.BETA_PREFLIGHT_REQUIRE_EVIDENCE),
    rls: strict || isTruthyFlag(env.BETA_PREFLIGHT_REQUIRE_RLS),
    supabaseStructural: strict || isTruthyFlag(env.BETA_PREFLIGHT_REQUIRE_SUPABASE_STRUCTURAL),
    smoke: strict || isTruthyFlag(env.BETA_PREFLIGHT_REQUIRE_SMOKE),
  }
}
