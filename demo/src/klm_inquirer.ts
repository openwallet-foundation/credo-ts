import { ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import inquirer from 'inquirer'
import { BaseInquirer } from './base_inquirer';
import { KLM } from './klm';
import { Color, Title } from './output_class';

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
      return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
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
        await this.klm.acceptConnection(getUrl.url)
        this.proofProposalListener()
    }

    async proof() {
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