import { CredentialEventTypes, CredentialState, CredentialStateChangedEvent, ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core'
import inquirer from 'inquirer'
import { restart } from './restart';
import { ConnectionRecord } from '@aries-framework/core';
import { BaseAgent } from './base_agent';
import { clear } from 'console';
import figlet from 'figlet';
import { Color, Output } from './output_class';

const ui = new inquirer.ui.BottomBar();

enum options {
  Connection = "setup connection",
  Proof = "propose proof",
  Message = "send message",
  Exit = "exit",
  Restart = "restart"
}

class Annelein extends BaseAgent {
  connectionRecordId?: string
  
  constructor(port: number, name: string) {
    super(port, name)
    super.initializeAgent() // this is not awaited..
    this.credentialOfferListener()
  }

  async credentialOfferListener() {
    this.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state !== CredentialState.OfferReceived){
          return
        }
        // open yes/no option in prompt
        // or maybe return something else first to start the prompt
      }
    )
  }

  async printConnectionInvite() {
    const invite = await this.agent.connections.createConnection()
    this.connectionRecordId = invite.connectionRecord.id

    console.log('\nYour invitation link:\n', invite.invitation.toUrl({domain: `http://localhost:${this.port}`}), '\n')
    return invite.connectionRecord
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordId) {
      throw Error(`${Color.red, Output.missingConnectionRecord, Color.reset}`)
    }
    return await this.agent.connections.getById(this.connectionRecordId)
  }

  async waitForConnection() {
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

  async sendProofProposal () {
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

  async sendMessage (message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  async exit() {
    console.log("Exiting")
    process.exit()
  }

  async restart() {
    await restart(this.agent)
    await this.agent.shutdown()
    //memory leak?
    runAnnelein()
  }
}


const runAnnelein = () => {
  clear();
  console.log(figlet.textSync('Annelein', { horizontalLayout: 'full' }));
  const annelein = new Annelein(9000, 'annelein')
}

runAnnelein()