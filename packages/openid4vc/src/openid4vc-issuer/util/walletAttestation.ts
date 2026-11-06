import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'

/**
 * Returns the parsed client attestation that should be verified, or `undefined` if the client attestation
 * is not required and `ignoreWalletAttestationsWhenNotRequired` is enabled.
 */
export function getClientAttestationToVerify<ClientAttestation>(
  config: OpenId4VcIssuerModuleConfig,
  clientAttestation: ClientAttestation | undefined,
  required: boolean | undefined
) {
  if (!required && config.ignoreWalletAttestationsWhenNotRequired) return undefined

  return clientAttestation
}
