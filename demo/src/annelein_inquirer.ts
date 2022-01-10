import inquirer from "inquirer";
import { Annelein } from "./annelein"
import { BaseInquirer } from "./base_inquirer"

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
      return await inquirer.prompt([this.getOptionsInquirer(this.promptOptionsString)])
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

    async connection() {
      await this.annelein.setupConnection()
    }

    async proof() {
      await this.annelein.sendProofProposal()
    }

    async message() {
      const message = await this.promptMessage()
      if (message === "") {
          return
      } 
      this.annelein.sendMessage(message)
    }

    async exit() {
      const confirm = await inquirer.prompt([this.getOptionsInquirerConfirm()])
      if (confirm.options === 'no'){
        return
      }
      await this.annelein.exit()
    }

    async restart() {
      const confirm = await inquirer.prompt([this.getOptionsInquirerConfirm()])
      if (confirm.options === 'no'){
        return
      }
      await this.annelein.restart()
    }
}