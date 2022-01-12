import { CredentialEventTypes, CredentialState, CredentialStateChangedEvent } from "@aries-framework/core";
import { clear } from "console";
import figlet from "figlet";
import inquirer from "inquirer";
import { Annelein } from "./annelein"
import { BaseInquirer } from "./base_inquirer"
import { Title } from "./output_class";

export enum PromptOptions {
    Connection = "setup connection",
    Proof = "propose proof",
    Message = "send message",
    Exit = "exit",
    Restart = "restart"
  }

class AnneleinInquirer extends BaseInquirer{
    annelein: Annelein
    promptOptionsString: string[]
    listenerOn: boolean

    constructor(annelein: Annelein) {
      super()
      this.annelein = annelein
      this.listenerOn = false
      this.promptOptionsString = Object.values(PromptOptions)
    }

    public static async build(): Promise<AnneleinInquirer> {
      const annelein = await Annelein.build()
      return new AnneleinInquirer(annelein)
    }

    private turnListenerOn(){
      this.listenerOn = true
    }

    private turnListenerOff(){
      this.listenerOn = false
    }

    async getPromptChoice() {
      return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (this.listenerOn === true){
        return
      }
      if (choice.options == PromptOptions.Connection){
          await this.connection()
      } else if (choice.options == PromptOptions.Proof){
          await this.proof()
      } else if (choice.options == PromptOptions.Message){
          await this.message()
      } else if (choice.options == PromptOptions.Exit){
          await this.exit()
      } else if (choice.options == PromptOptions.Restart){
          await this.restart()
          return
      }
      this.processAnswer()
    }

    private async acceptCredentialOffer(payload: any) {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.credentialOfferTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.annelein.acceptCredentialOffer(payload)
      }
    }

    async newConfirmPrompt(payload: any) {
      this.turnListenerOn()
      await this.acceptCredentialOffer(payload)
      this.turnListenerOff()
      this.processAnswer()
    }

    private credentialOfferListener() {
      this.annelein.agent.events.on(
        CredentialEventTypes.CredentialStateChanged,
        async ({ payload }: CredentialStateChangedEvent) => {
          if (payload.credentialRecord.state === CredentialState.OfferReceived){
            await this.newConfirmPrompt(payload)
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

export const runAnnelein = async () => {
  clear();
  console.log(figlet.textSync('Annelein', { horizontalLayout: 'full' }));
  const annelein = await AnneleinInquirer.build()
  annelein.processAnswer()
}

runAnnelein()