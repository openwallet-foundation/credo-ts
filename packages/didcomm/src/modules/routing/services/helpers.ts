import { type AgentContext, type DidDocument, Kms, TypedArrayEncoder } from '@credo-ts/core'

import { DidCommMediationRecipientService } from './DidCommMediationRecipientService'

export async function getMediationRecordForDidDocument(agentContext: AgentContext, didDocument: DidDocument) {
  // Mediator routing keys are stored as Ed25519 base58 strings; filter to Ed25519/X25519
  // since P-256 keys never appear in this wire format.
  const [mediatorRecord] = await agentContext
    .resolve(DidCommMediationRecipientService)
    .findAllMediatorsByQuery(agentContext, {
      recipientKeys: didDocument.recipientKeys
        .filter((key) => key.is(Kms.Ed25519PublicJwk, Kms.X25519PublicJwk))
        .map((key) => TypedArrayEncoder.toBase58(key.publicKey.publicKey)),
    })
  return mediatorRecord
}
