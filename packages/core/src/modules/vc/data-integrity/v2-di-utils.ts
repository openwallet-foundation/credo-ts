import type { AgentContext } from '../../../agent'
import { CredoError } from '../../../error'
import { asArray } from '../../../utils'
import { type DidPurpose, DidsApi, type VerificationMethod } from '../../dids'

/**
 * A Data Integrity proof, narrowed to the properties needed to identify the signer.
 */
type DataIntegrityProof = {
  verificationMethod: string
}

function isDataIntegrityProof(proof: unknown): proof is DataIntegrityProof {
  if (typeof proof !== 'object' || proof === null) return false

  const { verificationMethod } = proof as Record<string, unknown>
  return typeof verificationMethod === 'string'
}

/**
 * The part of a Data Integrity secured document this module needs: the embedded proof or proof
 * set. Both secured credentials and secured presentations satisfy this.
 */
type DataIntegritySecuredDocument = { proof: unknown }

function getProofs(securedDocument: DataIntegritySecuredDocument): DataIntegrityProof[] {
  return asArray(securedDocument.proof).filter(isDataIntegrityProof)
}

/**
 * Resolves the verification method that secured a Data Integrity credential or presentation for
 * an already verified proof or proof set.
 *
 * Mirrors `getVerificationMethodForJwt` for the Data Integrity securing mechanism, so that all
 * three securing mechanisms derive a signer the same way at the call site.
 *
 * A `proof` value may be a proof set, which per VC-DATA-INTEGRITY has no order. Its proof purposes
 * have already been validated by w3c-di before this helper is called. Where several proofs name
 * different verification methods, position therefore carries no meaning. `expectedController` is
 * used to disambiguate: the proof whose verification method is controlled by that identity is
 * selected. This is the co-signature case — several parties sign, and only the one identified as
 * the issuer or holder is relevant here.
 *
 * @param expectedController the identity the signer is expected to be, where known — the
 * credential's `issuer` or the presentation's `holder`. Omit when unknown, in which case an
 * ambiguous proof set is rejected rather than resolved arbitrarily.
 *
 * @throws {CredoError} if there is no proof with a verification method, if several verification
 * methods cannot be disambiguated, or if a verification method cannot be resolved.
 */
export async function getVerificationMethodForDataIntegrityProof(
  agentContext: AgentContext,
  securedDocument: DataIntegritySecuredDocument,
  purpose: DidPurpose,
  expectedController?: string
): Promise<VerificationMethod> {
  const proofs = getProofs(securedDocument)

  if (proofs.length === 0) {
    throw new CredoError('Data Integrity secured document does not contain a proof with a verification method')
  }

  const didsApi = agentContext.dependencyManager.resolve(DidsApi)

  const resolveVerificationMethod = async (verificationMethodId: string) => {
    const didDocument = await didsApi.resolveDidDocument(verificationMethodId)
    return didDocument.dereferenceKey(verificationMethodId, [purpose])
  }

  const verificationMethodIds = new Set(proofs.map((proof) => proof.verificationMethod))

  if (verificationMethodIds.size === 1) {
    return resolveVerificationMethod(proofs[0].verificationMethod)
  }

  if (!expectedController) {
    throw new CredoError(
      `Data Integrity secured document contains multiple proofs with different verification methods (${[...verificationMethodIds].join(', ')}). Unable to determine the signer.`
    )
  }

  const resolved = await Promise.all([...verificationMethodIds].map(resolveVerificationMethod))
  const matching = resolved.filter((verificationMethod) => verificationMethod.controller === expectedController)

  if (matching.length === 0) {
    throw new CredoError(
      `Data Integrity secured document contains multiple proofs, none of which is controlled by '${expectedController}'`
    )
  }

  return matching[0]
}

/**
 * Resolves the identity that secured a Data Integrity credential or presentation for the given
 * proof purpose.
 *
 * @param expectedController see `getVerificationMethodForDataIntegrityProof`.
 */
export async function getSignerForDataIntegrityProof(
  agentContext: AgentContext,
  securedDocument: DataIntegritySecuredDocument,
  purpose: DidPurpose,
  expectedController?: string
): Promise<string> {
  const verificationMethod = await getVerificationMethodForDataIntegrityProof(
    agentContext,
    securedDocument,
    purpose,
    expectedController
  )

  if (!verificationMethod.controller) {
    throw new CredoError(
      `Verification method '${verificationMethod.id}' does not have a controller to use as the signer`
    )
  }

  return verificationMethod.controller
}
