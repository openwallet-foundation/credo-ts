import type { AgentContext, DidPurpose, VerificationMethod } from '@credo-ts/core'
import { CredoError, DidsApi } from '@credo-ts/core'

type DidVerificationMethods = DidPurpose | 'verificationMethod'

export interface GetIssuerVerificationMethodOptions {
  /**
   * The issuer of the credential. The verification method is resolved from, and MUST belong to, the
   * did document of this issuer.
   */
  issuerId: string

  /**
   * An optional verification method id supplied by the caller. May be an absolute did url or a
   * relative fragment such as `#key-1`.
   */
  verificationMethodId?: string

  /**
   * The purposes a caller-supplied `verificationMethodId` is allowed to be listed under.
   */
  allowedPurposes: readonly DidVerificationMethods[]

  /**
   * The purposes to search, in order of preference, when no `verificationMethodId` is supplied.
   * Defaults to `allowedPurposes`.
   */
  discoveryPurposes?: readonly DidVerificationMethods[]
}

/**
 * Resolves the verification method an issuer should use to sign a credential.
 *
 * A caller-supplied verification method is dereferenced against the did document of the credential
 * issuer. This validates two things at once: that the verification method is listed under one of the
 * allowed purposes, and that it belongs to the issuer. Without the latter an issuer could sign with a
 * key from an unrelated did, producing a credential whose issuer does not match its signer.
 */
export async function getIssuerVerificationMethod(
  agentContext: AgentContext,
  { issuerId, verificationMethodId, allowedPurposes, discoveryPurposes }: GetIssuerVerificationMethodOptions
): Promise<{ verificationMethod: VerificationMethod }> {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(issuerId)

  if (verificationMethodId) {
    return { verificationMethod: didDocument.dereferenceKey(verificationMethodId, [...allowedPurposes]) }
  }

  const purposes = discoveryPurposes ?? allowedPurposes
  const [verificationMethod] = didDocument.findVerificationMethodsByPurpose(purposes)

  if (!verificationMethod) {
    throw new CredoError(
      `Unable to find a verification method for issuer '${issuerId}' in purposes ${purposes.join(', ')}.`
    )
  }

  return { verificationMethod }
}
