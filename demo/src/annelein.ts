import { CredentialEventTypes, CredentialState, CredentialStateChangedEvent, PresentationPreview, PresentationPreviewAttribute, ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core'
import inquirer from 'inquirer'
import { ConnectionRecord } from '@aries-framework/core';
import { BaseAgent } from './base_agent';
import { clear } from 'console';
import figlet from 'figlet';
import { Color, Output } from './output_class';
import { runAnnelein } from './annelein_inquirer';

export class Annelein extends BaseAgent {
  connectionRecordId?: string
  credDef: string
  
  constructor(port: number, name: string) {
    super(port, name)
    // super.initializeAgent() // this is not awaited..
    this.credDef = '7KuDTpQh3GJ7Gp6kErpWvM:3:CL:115269:latest'
  }

  public static async build(): Promise<Annelein> {
    const annelein = new Annelein(9000, 'annelein')
    await annelein.initializeAgent()
    return annelein
  }

  private async proposalSentListener () {
    this.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state !== ProofState.ProposalSent) {
          return 
        }
        console.log("\x1b[32m\nProposal sent!\n\x1b[0m");
        return
      }
    )
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordId) {
      throw Error(`${Color.red, Output.missingConnectionRecord, Color.reset}`)
    }
    return await this.agent.connections.getById(this.connectionRecordId)
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createConnection()
    this.connectionRecordId = invite.connectionRecord.id

    console.log('\nYour invitation link:\n', invite.invitation.toUrl({domain: `http://localhost:${this.port}`}), '\n')
    return invite.connectionRecord
  }

  private async waitForConnection() {
    // dit was eerst met if statement net zoals hier boven
    const connectionRecord = await this.getConnectionRecord()

    console.log("Waiting for KLM to finish connection...")
    await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(Output.connectionEstablished)
  }
  
  async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  async acceptCredentialOffer(payload: any) {
    await this.agent.credentials.acceptOffer(payload.credentialRecord.id)
    console.log("\x1b[32m\nCredential offer accepted!\n\x1b[0m")
  }

  private async newPresentationPreview() {
    const presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'name',
          credentialDefinitionId: this.credDef,
          value: 'annelein',
        }),
        new PresentationPreviewAttribute({
          name: 'date of birth',
          credentialDefinitionId: this.credDef,
          value: '09/09/1999',
        }),
        new PresentationPreviewAttribute({
          name: 'country of residence',
          credentialDefinitionId: this.credDef,
          value: 'the Netherlands',
        })
      ],
    })
    return presentationPreview
  }

  async sendProofProposal () {
    this.proposalSentListener()
    const connectionRecord = await this.getConnectionRecord()
    const presentationPreview = await this.newPresentationPreview()
    await this.agent.proofs.proposeProof(connectionRecord.id, presentationPreview)
  }

  async sendMessage (message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  async exit() {
    console.log("Exiting")
    process.exit()
  }

  async restart() {
    await this.agent.shutdown()
    runAnnelein()
    //memory leak?
  }
}
