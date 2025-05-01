import { type AgentContext, type DidDocument, TypedArrayEncoder } from '@credo-ts/core'

import { MediationRecipientService } from './MediationRecipientService'

export async function getMediationRecordForDidDocument(agentContext: AgentContext, didDocument: DidDocument) {
  const [mediatorRecord] = await agentContext.resolve(MediationRecipientService).findAllMediatorsByQuery(agentContext, {
    recipientKeys: didDocument.recipientKeys.map((key) => TypedArrayEncoder.toBase58(key.publicKey.publicKey)),
  })
  return mediatorRecord
}
