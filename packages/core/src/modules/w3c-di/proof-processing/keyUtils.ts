import type { AgentContext } from '../../../agent/context'
import { DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../../dids'
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

/**
 * Map a verification method identifier to its KMS key ID.
 *
 * Attempts to find the key ID in the DID record's key metadata.
 * Falls back to the public JWK's legacy key ID if not found.
 *
 * @param agentContext - The agent context for DID resolution and key lookup
 * @param verificationMethodId - The verification method identifier (typically a DID fragment)
 * @returns Promise<string> - The KMS key ID for the verification method
 */
export async function publicKeyIdFromVerificationMethodId(
  agentContext: AgentContext,
  verificationMethodId: string
): Promise<string> {
  const didApi = agentContext.dependencyManager.resolve(DidsApi)
  const parsedDid = parseDid(verificationMethodId)
  const [didRecord] = await didApi.getCreatedDids({ did: parsedDid.did })

  const publicJwk = await publicJwkFromVerificationMethodId(agentContext, verificationMethodId)
  return (
    didRecord?.keys?.find(({ didDocumentRelativeKeyId }) => didDocumentRelativeKeyId === `#${parsedDid.fragment}`)
      ?.kmsKeyId ?? publicJwk.legacyKeyId
  )
}
