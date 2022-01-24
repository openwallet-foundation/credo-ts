/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { CredentialRecord, ProofRecord } from '@aries-framework/core'

import { BaseAgent } from './base_agent'
import { Color, Output } from './output_class'

export class Alice extends BaseAgent {
  public connectionRecordFaberId?: string
  public credDef: string

  public constructor(port: number, name: string) {
    super(port, name)
    this.credDef = '7KuDTpQh3GJ7Gp6kErpWvM:3:CL:115269:latest'
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice')
    await alice.initializeAgent()
    return alice
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(`${Color.red}${Output.missingConnectionRecord}${Color.reset}`)
    }
    return await this.agent.connections.getById(this.connectionRecordFaberId)
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createConnection()
    this.connectionRecordFaberId = invite.connectionRecord.id

    console.log(Output.connectionLink, invite.invitation.toUrl({ domain: `http://localhost:${this.port}` }), '\n')
    return invite.connectionRecord
  }

  private async waitForConnection() {
    const connectionRecord = await this.getConnectionRecord()

    console.log('Waiting for Faber to finish connection...')
    await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(`${Color.green}${Output.connectionEstablished}${Color.reset}`)
  }

  public async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  public async acceptCredentialOffer(credentialRecord: CredentialRecord) {
    await this.agent.credentials.acceptOffer(credentialRecord.id)
    console.log(`${Color.green}\nCredential offer accepted!\n${Color.reset}`)
  }

  public async acceptProofRequest(proofRecord: ProofRecord) {
    const retrievedCredentials = await this.agent.proofs.getRequestedCredentialsForProofRequest(proofRecord.id, {
      filterByPresentationPreview: true,
    })
    const requestedCredentials = this.agent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await this.agent.proofs.acceptRequest(proofRecord.id, requestedCredentials)
    console.log(`${Color.green}\nProof request accepted!\n${Color.reset}`)
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.exit)
    await this.agent.shutdown()
    process.exit()
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
