import type { AgentContext } from '../../../agent'
import type { DidDocument } from '../../dids'

import { MediationRecipientService } from './MediationRecipientService'

export async function getMediationRecordForDidDocument(agentContext: AgentContext, didDocument: DidDocument) {
  const [mediatorRecord] = await agentContext.dependencyManager
    .resolve(MediationRecipientService)
    .findAllMediatorsByQuery(agentContext, {
      recipientKeys: didDocument.recipientKeys.map((key) => key.publicKeyBase58),
    })
  return mediatorRecord
}
