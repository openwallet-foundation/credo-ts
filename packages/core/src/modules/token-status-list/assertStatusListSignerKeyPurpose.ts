import type { AgentContext } from '../../agent'
import { validateRequiredExtendedKeyUsages, validateRequiredKeyUsages } from '../x509/utils/keyPurpose'
import { type X509Certificate, X509ExtendedKeyUsage, X509KeyUsage } from '../x509/X509Certificate'
import { X509Error } from '../x509/X509Error'
import { TokenStatusListModuleConfig } from './TokenStatusListModuleConfig'

/**
 * A status list signer that doesn't use the key of the credential issuer has to be delegated through
 * the extended key usage. Expects both certificates to be validated.
 *
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-status-list-21#section-11.3
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
  if (!agentContext.resolve(TokenStatusListModuleConfig).requireStatusSigningKeyPurpose) return
  if (statusListSigner.publicJwk.equals(credentialSigner.publicJwk)) return

  const failedValidation = [
    validateRequiredExtendedKeyUsages(statusListSigner, [X509ExtendedKeyUsage.OauthStatusSigning]),
    validateRequiredKeyUsages(statusListSigner, [X509KeyUsage.DigitalSignature]),
  ].find((validation) => !validation.isValid)

  if (failedValidation) {
    throw new X509Error(
      `The ${list} signer certificate does not have the required key purpose. ${failedValidation.error?.message}`,
      { cause: failedValidation.error }
    )
  }
}
