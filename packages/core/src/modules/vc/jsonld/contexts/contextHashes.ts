/**
 * Normative SHA2-256 hash values for standard W3C Data Integrity context documents.
 *
 * Source: W3C VC Data Integrity 1.0 §2.4 Contexts and Vocabularies
 * https://www.w3.org/TR/vc-data-integrity/#contexts-and-vocabularies
 *
 * Implementations MUST treat these context URLs as already resolved and MUST verify
 * that the resolved document matches the corresponding hash value.
 */
export const DI_SPEC_CONTEXT_HASHES: Record<string, string> = {
  'https://w3id.org/security/data-integrity/v2': '67f21e6e33a6c14e5ccfd2fc7865f7474fb71a04af7e94136cb399dfac8ae8f4',
  'https://w3id.org/security/multikey/v1': 'ba2c182de2d92f7e47184bcca8fcf0beaee6d3986c527bf664c195bbc7c58597',
  'https://w3id.org/security/jwk/v1': '0f14b62f6071aafe00df265770ea0c7508e118247d79b7d861a406d2aa00bece',
}
