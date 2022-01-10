import { CredentialEventTypes, CredentialState, CredentialStateChangedEvent } from "@aries-framework/core";
import inquirer from "inquirer";
import { Annelein } from "./annelein"
import { BaseInquirer } from "./base_inquirer"
import { Title } from "./output_class";

export enum promptOptions {
    Connection = "setup connection",
    Proof = "propose proof",
    Message = "send message",
    Exit = "exit",
    Restart = "restart"
  }

class AnneleinInquirer extends BaseInquirer{
    annelein: Annelein
    promptOptionsString: string[]

    constructor() {
      super()
      this.promptOptionsString = Object.keys(promptOptions).map((key) => (key))
      this.annelein = new Annelein(9000, 'annelein')
    }

    async getPromptChoice() {
      return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (choice.options == promptOptions.Connection){
          this.connection()
      } else if (choice.options == promptOptions.Proof){
          this.proof()
      } else if (choice.options == promptOptions.Message){
          this.message()
      } else if (choice.options == promptOptions.Exit){
          this.exit()
      } else if (choice.options == promptOptions.Restart){
          this.restart()
      }
      this.processAnswer()
    }

    private credentialOfferListener() {
      this.annelein.agent.events.on(
        CredentialEventTypes.CredentialStateChanged,
        async ({ payload }: CredentialStateChangedEvent) => {
          if (payload.credentialRecord.state !== CredentialState.OfferReceived){
            const confirm = this.inquireConfirmation(Title.proofProposalTitle)
            if (confirm.options === 'no'){
              return
            } else if (confirm.options === 'yes'){
              this.inquireConfirmation(Title.credentialOfferTitle)
            }
          }
          return
        }
      )
    }

    async connection() {
      await this.annelein.setupConnection()
      this.credentialOfferListener()
    }

    async proof() {
      await this.annelein.sendProofProposal()
    }

    async message() {
      const message = await this.inquireMessage()
      if (message === null) {
          return
      } 
      this.annelein.sendMessage(message)
    }

    async exit() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.annelein.exit()
      }
    }

    async restart() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.annelein.restart()
      }
    }
}