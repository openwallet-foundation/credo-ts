import type { AgentContext } from '../../../agent/context'
import { DidsApi, getPublicJwkFromVerificationMethod } from '../../dids'
import type { PublicJwk } from '../../kms'

/**
 * Extract public JWK from a verification method identifier.
 *
 * Resolves the DID document, dereferences the verification method,
 * and extracts the public JWK.
 *
 * @param agentContext - The agent context for DID resolution
 * @param verificationMethodId - The verification method identifier (typically a DID fragment)
 * @returns Promise<PublicJwk> - The public JWK from the verification method
 */
export async function publicJwkFromVerificationMethodId(
  agentContext: AgentContext,
  verificationMethodId: string
): Promise<PublicJwk> {
  // Currently only DID-backed verification methods are supported. To support non-DID
  // verification method URLs (e.g. HTTP key registries), introduce a documentLoader
  // parameter here and dispatch on URL scheme before falling back to DidsApi resolution.
  const didApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didApi.resolveDidDocument(verificationMethodId)
  const verificationMethod = didDocument.dereferenceVerificationMethod(verificationMethodId)
  const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
  return publicJwk
}
