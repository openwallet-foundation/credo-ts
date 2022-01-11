import { ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import { clear } from 'console';
import figlet from 'figlet';
import inquirer from 'inquirer'
import { Annelein } from './annelein';
import { BaseInquirer } from './base_inquirer';
import { KLM } from './klm';
import { Color, Title } from './output_class';

  export enum PromptOptions {
    Connection = "setup connection",
    Credential = "offer credential",
    Message = "send message",
    Exit = "exit",
    Restart = "restart"
  }

class KlmInquirer extends BaseInquirer{
    klm: KLM
    promptOptionsString: string[]

    constructor(klm: KLM) {
      super()
      this.promptOptionsString = Object.values(PromptOptions)
      this.klm = klm
    }

    public static async build(): Promise<KlmInquirer> {
      const klm = await KLM.build()
      return new KlmInquirer(klm)
    }

    async getPromptChoice() {
      return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (choice.options == PromptOptions.Connection){
          await this.connection()
      } else if (choice.options == PromptOptions.Credential){
          await this.credential()
      } else if (choice.options == PromptOptions.Message){
          await this.message()
      } else if (choice.options == PromptOptions.Exit){
          await this.exit()
      } else if (choice.options == PromptOptions.Restart){
          await this.restart()
      }
      this.processAnswer()
    }

    private proofProposalListener() {
      this.klm.agent.events.on(ProofEventTypes.ProofStateChanged,
        async ({ payload }: ProofStateChangedEvent) => {
          if (payload.proofRecord.state !== ProofState.ProposalReceived) {
            const confirm = this.inquireConfirmation(Title.proofProposalTitle)
            if (confirm.options === 'no'){
              return
            } else if (confirm.options === 'yes'){
              await this.klm.agent.proofs.acceptProposal(payload.proofRecord.id)
              console.log(`${Color.green}\nProof accepted!\n${Color.reset}`);
            }
          }
          return
        })
      }

    async connection() {
      const title = 'Paste the invitation url here:'
      const getUrl = await inquirer.prompt([this.inquireInput(title)])
      await this.klm.acceptConnection(getUrl.input)
      this.proofProposalListener()
    }

    async credential() {
      await this.klm.issueCredential()
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

const runKlm = async () => {
  clear();
  console.log(figlet.textSync('KLM', { horizontalLayout: 'full' }));
  const klm = await KlmInquirer.build()
  klm.processAnswer()
}

runKlm()