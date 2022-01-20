import { Agent, CredentialStateChangedEvent } from "@aries-framework/core"
import { CredentialState } from "@aries-framework/core"
import { ProofStateChangedEvent } from "@aries-framework/core"
import { ProofState } from "@aries-framework/core"
import { BasicMessageStateChangedEvent } from "@aries-framework/core"
import { BasicMessageEventTypes } from "@aries-framework/core"
import { ProofEventTypes } from "@aries-framework/core"
import { CredentialEventTypes } from "@aries-framework/core"
import { Alice } from "./alice"
import { AliceInquirer } from "./alice_inquirer"
import { Color } from "./output_class"
import inquirer from 'inquirer'
import { Faber } from "./faber"
import { FaberInquirer } from "./faber_inquirer"

export class Listener{
  on: boolean
  ui: any

  constructor(){
    this.on = false
    this.ui = new inquirer.ui.BottomBar();
  }

  private turnListenerOn() {
      this.on = true
  }

  private turnListenerOff() {
      this.on = false
  }

  private async newCredentialPrompt(payload: any, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    console.log(payload.credentialPreview)
    await aliceInquirer.acceptCredentialOffer(payload)
    this.turnListenerOff()
    aliceInquirer.processAnswer()
  }

  credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
      alice.agent.events.on(
        CredentialEventTypes.CredentialStateChanged,
        async ({ payload }: CredentialStateChangedEvent) => {
          if (payload.credentialRecord.state === CredentialState.OfferReceived){
              await this.newCredentialPrompt(payload, aliceInquirer)
          }
          return
        }
      )
  }

  messageListener(agent: Agent, name: string) {
    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged,
      async (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === 'receiver') {
        this.ui.updateBottomBar(`${Color.purlpe}\n${name} received a message: ${event.payload.message.content}\n${Color.reset}`);
      }
      return
    })
  }

  private async newProofRequestPrompt(payload: any, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    await aliceInquirer.acceptProofRequest(payload)
    this.turnListenerOff()
    aliceInquirer.processAnswer()
  }

  proofRequestListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.RequestReceived){
            await this.newProofRequestPrompt(payload, aliceInquirer)
        }
        return
      }
    )
  }

  proofAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.Done){
          faberInquirer.processAnswer()
        }
        return
      }
    )
  }

  credentialAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
   faber.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.Done){
          faberInquirer.processAnswer()
        }
        return
      }
    )
}
}