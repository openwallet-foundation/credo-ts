import type {
  DidCommConnectionRecord,
  DidCommCredentialExchangeRecord,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Alice extends BaseAgent {
  public connected: boolean
  public connectionRecordFaberId?: string

  public constructor(port: number, name: string) {
    super({ port, name })
    this.connected = false
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice')
    await alice.initializeAgent()
    return alice
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.didcomm.connections.getById(this.connectionRecordFaberId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
      label: 'alice',
    })
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  private async waitForConnection(connectionRecord: DidCommConnectionRecord) {
    const record = await this.agent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)
    this.connected = true
    console.log(greenText(Output.ConnectionEstablished))
    return record.id
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordFaberId = await this.waitForConnection(connectionRecord)
  }

  public async acceptCredentialOffer(credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    await this.agent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: credentialExchangeRecord.id,
    })
  }

  public async acceptProofRequest(proofExchangeRecord: DidCommProofExchangeRecord) {
    const requestedCredentials = await this.agent.didcomm.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: proofExchangeRecord.id,
    })

    await this.agent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: proofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })
    console.log(greenText('\nProof request accepted!\n'))
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.didcomm.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
