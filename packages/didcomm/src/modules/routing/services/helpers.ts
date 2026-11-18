import {
  type AgentContext,
  type DidDocument,
  getDidPeer4ShortFormForEquivalence,
  Kms,
  TypedArrayEncoder,
} from '@credo-ts/core'

import { DidCommMediationRecipientService } from './DidCommMediationRecipientService'

/**
 * Find the mediation record that routes a DID document of ours.
 *
 * A Coordinate Mediation 2.0 record registers the DID itself (`recipientDids`). A 1.0 record registers the
 * recipient keys of the document as base58 (`recipientKeys`). The v1 keys and the v2 keyAgreement keys
 * are both looked up, so a DID document with only a DIDComm v2 service is found as well.
 */
export async function getMediationRecordForDidDocument(agentContext: AgentContext, didDocument: DidDocument) {
  const mediationRecipientService = agentContext.resolve(DidCommMediationRecipientService)

  const recipientDid = getDidPeer4ShortFormForEquivalence(didDocument.id) ?? didDocument.id
  const [recordByDid] = await mediationRecipientService.findAllMediatorsByQuery(agentContext, {
    recipientDids: [recipientDid],
  })
  if (recordByDid) return recordByDid

  // Mediator routing keys are stored as base58 strings; P-256 and P-384 keys never appear in this format.
  const recipientKeys = didDocument.allDidCommRecipientKeys
    .filter((key) => key.is(Kms.Ed25519PublicJwk, Kms.X25519PublicJwk))
    .map((key) => TypedArrayEncoder.toBase58(key.publicKey.publicKey))

  // An empty array query matches every record, so a document without such keys has no mediation record
  if (recipientKeys.length === 0) return undefined

  const [recordByKeys] = await mediationRecipientService.findAllMediatorsByQuery(agentContext, { recipientKeys })
  return recordByKeys
}
