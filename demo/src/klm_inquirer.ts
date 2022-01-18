import { ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import { clear } from 'console';
import figlet from 'figlet';
import inquirer from 'inquirer'
import { BaseInquirer } from './base_inquirer';
import { KLM } from './klm';
import { Listener } from './listener';
import { Title } from './output_class';


enum PromptOptions {
  Connection = "setup connection",
  Credential = "offer credential",
  Proof = "proof request",
  Message = "send message",
  Exit = "exit",
  Restart = "restart"
}

export class KlmInquirer extends BaseInquirer{
    klm: KLM
    promptOptionsString: string[]
    listener: Listener

    constructor(klm: KLM) {
      super()
      this.klm = klm
      this.listener = new Listener()
      this.promptOptionsString = Object.values(PromptOptions)
      this.listener.messageListener(this.klm.agent, this.klm.name)
    }

    public static async build(): Promise<KlmInquirer> {
      const klm = await KLM.build()
      return new KlmInquirer(klm)
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
      switch(choice){
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

    async proofProposalPrompt(payload: any) {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.proofProposalTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.klm.acceptProofProposal(payload)
      }
    }

    async connection() {
      const title = Title.invitationTitle
      const getUrl = await inquirer.prompt([this.inquireInput(title)])
      await this.klm.acceptConnection(getUrl.input)
      this.listener.proofProposalListener(this.klm, this)
    }

    async credential() {
      await this.klm.issueCredential()
    }

    async proof() {
      await this.klm.sendProofRequest()
    }

    async message() {
      const message = await this.inquireMessage()
      if (message === null) {
          return
      }
      this.klm.sendMessage(message)
    }

    async exit() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.klm.exit()
      }
    }

    async restart() {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.klm.restart()
      }
    }
}

export const runKlm = async () => {
  clear();
  console.log(figlet.textSync('KLM', { horizontalLayout: 'full' }));
  const klm = await KlmInquirer.build()
  klm.processAnswer()
}

runKlm()