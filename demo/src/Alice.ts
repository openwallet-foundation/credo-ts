import type { ConnectionRecord, CredentialExchangeRecord, ProofExchangeRecord } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Alice extends BaseAgent {
  public connected: boolean
  public connectionRecordFaberId?: string

  public constructor(port: number, name: string) {
    super(port, name)
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
    return await this.agent.connections.getById(this.connectionRecordFaberId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl)
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    this.connected = true
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordFaberId = await this.waitForConnection(connectionRecord)
  }

  public async acceptCredentialOffer(credentialRecord: CredentialExchangeRecord) {
    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    })
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials = await this.agent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: proofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
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

  public async createNewDID() {
    const { didState } = await this.agent.dids.createV2DID({
      method: 'peer',
      routing: { endpoint: this.agent.config.endpoints[0] },
    })
    console.log(greenText(`\nNew DID Created!\n DID: ${didState.did}`))
  }

  public async sendPingDIDCommV2(fromDid: string, toDid: string) {
    await this.agent.connections.pingDIDCommV2(fromDid, toDid)
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
