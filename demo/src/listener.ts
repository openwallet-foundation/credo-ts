import { Agent, CredentialStateChangedEvent } from "@aries-framework/core"
import { CredentialState } from "@aries-framework/core"
import { ProofStateChangedEvent } from "@aries-framework/core"
import { ProofState } from "@aries-framework/core"
import { BasicMessageStateChangedEvent } from "@aries-framework/core"
import { BasicMessageEventTypes } from "@aries-framework/core"
import { ProofEventTypes } from "@aries-framework/core"
import { CredentialEventTypes } from "@aries-framework/core"
import { Annelein } from "./annelein"
import { AnneleinInquirer } from "./annelein_inquirer"
import { KLM } from "./klm"
import { KlmInquirer } from "./klm_inquirer"
import { Color } from "./output_class"
import inquirer from 'inquirer'

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

    private async newCredentialPrompt(payload: any, anneleinInquirer: AnneleinInquirer) {
      this.turnListenerOn()
      await anneleinInquirer.acceptCredentialOffer(payload)
      this.turnListenerOff()
      anneleinInquirer.processAnswer()
    }

    credentialOfferListener(annelein: Annelein, anneleinInquirer: AnneleinInquirer) {
        annelein.agent.events.on(
          CredentialEventTypes.CredentialStateChanged,
          async ({ payload }: CredentialStateChangedEvent) => {
            if (payload.credentialRecord.state === CredentialState.OfferReceived){
                await this.newCredentialPrompt(payload, anneleinInquirer)
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
  
    private async newProofRequestPrompt(payload: any, anneleinInquirer: AnneleinInquirer) {
      this.turnListenerOn()
      await anneleinInquirer.acceptProofRequest(payload)
      this.turnListenerOff()
      anneleinInquirer.processAnswer()
    }

    proofRequestListener(annelein: Annelein, anneleinInquirer: AnneleinInquirer) {
      annelein.agent.events.on(
        ProofEventTypes.ProofStateChanged,
        async ({ payload }: ProofStateChangedEvent) => {
          if (payload.proofRecord.state === ProofState.RequestReceived){
              await this.newProofRequestPrompt(payload, anneleinInquirer)
          }
          return
        }
      )
  }
}