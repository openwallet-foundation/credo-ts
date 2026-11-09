import type { AgentContext } from '../../agent'
import { validateRequiredExtendedKeyUsages, validateRequiredKeyUsages } from '../x509/utils/keyPurpose'
import { type X509Certificate, X509ExtendedKeyUsage, X509KeyUsage } from '../x509/X509Certificate'
import { X509Error } from '../x509/X509Error'
import type { X509ValidateCertificateChainOptions } from '../x509/X509ServiceOptions'
import { TokenStatusListModuleConfig } from './TokenStatusListModuleConfig'

/**
 * The key purposes to pass to `X509Service.validateCertificateChain` for a status list signer. A signer
 * that doesn't use the key of the credential issuer has to be delegated through the extended key usage.
 *
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-status-list-21#section-11.3
 */
export function getStatusListSignerKeyPurposeOptions(
  agentContext: AgentContext,
  { statusListSigner, credentialSigner }: { statusListSigner: X509Certificate; credentialSigner: X509Certificate }
): Pick<X509ValidateCertificateChainOptions, 'requiredKeyUsages' | 'requiredExtendedKeyUsages'> {
  if (!agentContext.resolve(TokenStatusListModuleConfig).requireStatusSigningKeyPurpose) return {}
  if (statusListSigner.publicJwk.equals(credentialSigner.publicJwk)) return {}

  return {
    requiredExtendedKeyUsages: [X509ExtendedKeyUsage.OauthStatusSigning],
    requiredKeyUsages: [X509KeyUsage.DigitalSignature],
  }
}

/**
 * Checks {@link getStatusListSignerKeyPurposeOptions} on a chain that was already validated without
 * them. Expects both certificates to be validated.
 */
export function assertStatusListSignerKeyPurpose(
  agentContext: AgentContext,
  {
    statusListSigner,
    credentialSigner,
    list = 'status list',
  }: {
    statusListSigner: X509Certificate
    credentialSigner: X509Certificate
    list?: 'status list' | 'identifier list'
  }
) {
  const { requiredExtendedKeyUsages = [], requiredKeyUsages = [] } = getStatusListSignerKeyPurposeOptions(
    agentContext,
    { statusListSigner, credentialSigner }
  )

  const failedValidation = [
    validateRequiredExtendedKeyUsages(statusListSigner, requiredExtendedKeyUsages),
    validateRequiredKeyUsages(statusListSigner, requiredKeyUsages),
  ].find((validation) => !validation.isValid)

  if (failedValidation) {
    throw new X509Error(
      `The ${list} signer certificate does not have the required key purpose. ${failedValidation.error?.message}`,
      { cause: failedValidation.error }
    )
  }
}
