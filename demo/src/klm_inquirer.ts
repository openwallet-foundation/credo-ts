import inquirer from 'inquirer'
import { BaseInquirer } from './base_inquirer';
import { KLM } from './klm';

  export enum promptOptions {
    Connection = "setup connection",
    Credential = "offer credential",
    Message = "send message",
    Exit = "exit",
    Restart = "restart"
  }

class KlmInquirer extends BaseInquirer{
    klm: KLM
    promptOptionsString: string[]

    constructor() {
      super()
      this.promptOptionsString = Object.keys(promptOptions).map((key) => (key))
      this.klm = new KLM(9001, 'klm')
    }

    async getPromptChoice() {
      return await inquirer.prompt([this.getOptionsInquirer(this.promptOptionsString)])
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (choice.options == promptOptions.Connection){
          this.connection()
      } else if (choice.options == promptOptions.Credential){
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
      const getUrl = await inquirer.prompt([this.getInputInquirerInvitation()])
      await this.klm.acceptConnection(getUrl.url)
    }

    async proof() {
      await this.klm.issueCredential()
    }

    async message() {
      const message = await this.promptMessage()
      if (message === "") {
          return
      } 
      this.klm.sendMessage(message)
    }

    async exit() {
      await this.klm.exit()
    }

    async restart() {
      await this.klm.restart()
    }
}