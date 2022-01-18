import { PresentationPreview, PresentationPreviewAttribute, ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core'
import { BaseAgent } from './base_agent';
import { Color, Output } from './output_class';
import { runAnnelein } from './annelein_inquirer';

export class Annelein extends BaseAgent {
  connectionRecordKLMId?: string
  credDef: string
  
  constructor(port: number, name: string) {
    super(port, name)
    this.credDef = '7KuDTpQh3GJ7Gp6kErpWvM:3:CL:115269:latest'
  }

  public static async build(): Promise<Annelein> {
    const annelein = new Annelein(9000, 'annelein')
    await annelein.initializeAgent()
    return annelein
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordKLMId) {
      throw Error(`${Color.red}${Output.missingConnectionRecord}${Color.reset}`)
    }
    return await this.agent.connections.getById(this.connectionRecordKLMId)
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createConnection()
    this.connectionRecordKLMId = invite.connectionRecord.id

    console.log('\nYour invitation link:\n', invite.invitation.toUrl({domain: `http://localhost:${this.port}`}), '\n')
    return invite.connectionRecord
  }

  private async waitForConnection() {
    const connectionRecord = await this.getConnectionRecord()

    console.log("Waiting for KLM to finish connection...")
    await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(`${Color.green}${Output.connectionEstablished}${Color.reset}`)
  }
  
  async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  async acceptCredentialOffer(payload: any) {
    await this.agent.credentials.acceptOffer(payload.credentialRecord.id)
    console.log(`${Color.green}\nCredential offer accepted!\n${Color.reset}`)
  }

  async acceptProofRequest(payload: any) {
    const retrievedCredentials = await this.agent.proofs.getRequestedCredentialsForProofRequest(payload.proofRecord.id, {
      filterByPresentationPreview: true,
    })
    const requestedCredentials = this.agent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await this.agent.proofs.acceptRequest(payload.proofRecord.id, requestedCredentials)
    console.log(`${Color.green}\nProof request accepted!\n${Color.reset}`)
  }

  async sendMessage (message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  async exit() {
    console.log("Exiting...")
    await this.agent.shutdown()
    process.exit()
  }

  async restart() {
    await this.agent.shutdown()
    runAnnelein()
  }
}
