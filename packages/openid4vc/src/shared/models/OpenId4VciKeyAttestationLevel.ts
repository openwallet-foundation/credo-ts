/**
 * Key attestation levels for the `key_storage` and `user_authentication` values.
 *
 * Currently only the ISO 18045 attack potential resistance levels defined by OpenID4VCI are
 * included.
 *
 * @see https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-D.2
 */
export enum OpenId4VciKeyAttestationLevel {
  Basic = 'iso_18045_basic',
  EnhancedBasic = 'iso_18045_enhanced-basic',
  Moderate = 'iso_18045_moderate',
  High = 'iso_18045_high',
}

/**
 * The ISO 18045 levels ordered from weakest to strongest. The array index represents the
 * level rank and is used to compare levels hierarchically.
 */
const orderedIso18045Levels = [
  OpenId4VciKeyAttestationLevel.Basic,
  OpenId4VciKeyAttestationLevel.EnhancedBasic,
  OpenId4VciKeyAttestationLevel.Moderate,
  OpenId4VciKeyAttestationLevel.High,
]

/**
 * Whether an attested set of key attestation levels (`key_storage` or `user_authentication`)
 * satisfies a required set of levels.
 *
 * Both `required` and `attested` are treated with OR semantics: the requirement is satisfied
 * if any attested value meets-or-exceeds any required value.
 *
 * Known ISO 18045 values are compared by rank, so a stronger attested level (e.g.
 * `iso_18045_high`) satisfies a weaker required level (e.g. `iso_18045_moderate`). Any custom
 * (non-ISO) string is only matched exactly, so we never loosen a requirement we don't understand.
 */
export function keyAttestationLevelSatisfies(required: string[], attested: string[] | undefined): boolean {
  if (!attested) return false

  return required.some((requiredLevel) =>
    attested.some((attestedLevel) => {
      if (attestedLevel === requiredLevel) return true

      const requiredRank = orderedIso18045Levels.indexOf(requiredLevel as OpenId4VciKeyAttestationLevel)
      const attestedRank = orderedIso18045Levels.indexOf(attestedLevel as OpenId4VciKeyAttestationLevel)

      // Only compare by rank when both values are known ISO 18045 levels
      if (requiredRank === -1 || attestedRank === -1) return false

      return attestedRank >= requiredRank
    })
  )
}
