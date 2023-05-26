import type { CredentialExchangeRecord, ProofExchangeRecord } from '@aries-framework/core'

import { BaseAlice } from '../BaseAlice'
import { greenText } from '../OutputClass'

export class Alice extends BaseAlice {
  public constructor(port: number, name: string) {
    super(port, name)
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice')
    await alice.initializeAgent()
    return alice
  }

  public async acceptCredentialOffer(credentialRecord: CredentialExchangeRecord) {
    const linkSecretIds = await this.agent.modules.anoncreds.getLinkSecretIds()
    if (linkSecretIds.length === 0) {
      await this.agent.modules.anoncreds.createLinkSecret()
    }

    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    })
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials = await this.agent.proofs.selectCredentialsForRequest({
      proofRecordId: proofRecord.id,
    })

    await this.agent.proofs.acceptRequest({
      proofRecordId: proofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })
    console.log(greenText('\nProof request accepted!\n'))
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }
}
