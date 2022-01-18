import { ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import { clear } from 'console';
import figlet from 'figlet';
import inquirer from 'inquirer'
import { BaseInquirer } from './base_inquirer';
import { Faber } from './faber';
import { Listener } from './listener';
import { Title } from './output_class';


enum PromptOptions {
  Connection = "setup connection",
  Credential = "offer credential",
  Proof = "request proof",
  Message = "send message",
  Exit = "exit",
  Restart = "restart"
}

export class FaberInquirer extends BaseInquirer{
    faber: Faber
    promptOptionsString: string[]
    listener: Listener

    constructor(faber: Faber) {
      super()
      this.faber = faber
      this.listener = new Listener()
      this.promptOptionsString = Object.values(PromptOptions)
      this.listener.messageListener(this.faber.agent, this.faber.name)
    }

    public static async build(): Promise<FaberInquirer> {
      const faber = await Faber.build()
      return new FaberInquirer(faber)
    }

    async getPromptChoice(){
      const prompt = inquirer.prompt([this.inquireOptions(this.promptOptionsString)]);
      return prompt
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (this.listener.on === true) {
        return
      }
      switch(choice.options){
        case PromptOptions.Connection:
          await this.connection()
          break
        case PromptOptions.Credential:
          await this.credential()
          break
        case PromptOptions.Proof:
          await this.proof()
          break
        case PromptOptions.Message:
          await this.message()
          break
        case PromptOptions.Exit:
          await this.exit()
          break
        case PromptOptions.Restart:
          await this.restart()
          return
      }
      this.processAnswer()
    }

    async connection() {
      const title = Title.invitationTitle
      const getUrl = await inquirer.prompt([this.inquireInput(title)])
      await this.faber.acceptConnection(getUrl.input)
    }

    async credential() {
      await this.faber.issueCredential()
    }

    async proof() {
      await this.faber.sendProofRequest()
    }

    async message() {
      const message = await this.inquireMessage()
      if (message === null) {
          return
      }
      this.faber.sendMessage(message)
    }

    async exit() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.faber.exit()
      }
    }

    async restart() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        this.processAnswer()
        return
      } else if (confirm.options === 'yes'){
        await this.faber.restart()
      }
    }
}

export const runFaber = async () => {
  clear();
  console.log(figlet.textSync('Faber', { horizontalLayout: 'full' }));
  const faber = await FaberInquirer.build()
  faber.processAnswer()
}

runFaber()