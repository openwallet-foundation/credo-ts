import { ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import { clear } from 'console';
import figlet from 'figlet';
import inquirer from 'inquirer'
import { BaseInquirer } from './base_inquirer';
import { KLM } from './klm';
import { Title } from './output_class';


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
    listenerOn: boolean
    permissionTimeout: any

    constructor(klm: KLM) {
      super()
      this.promptOptionsString = Object.values(PromptOptions)
      this.klm = klm
      this.listenerOn = false
    }

    public static async build(): Promise<KlmInquirer> {
      const klm = await KLM.build()
      return new KlmInquirer(klm)
    }

    async getPromptChoice(){
      const prompt = inquirer.prompt([this.inquireOptions(this.promptOptionsString)]);
  
      // const timeoutPromise = new Promise(resolve => {
      //   this.permissionTimeout = setInterval(() => {
      //     if (this.listenerOn === true){
      //       resolve(false)
      //     }
      //   }, 0.1 * 1000);
      // });
  
      // const promise = (async () => {
      //   const optIn = await prompt;
      //   if (this.permissionTimeout){
      //     clearInterval(this.permissionTimeout)
      //   }
      //   return optIn;
      // })();
  
      // // Return the result of the prompt if it finishes first otherwise default to the timeout's value.
      // return Promise.race([promise, timeoutPromise]);
      return prompt
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (this.listenerOn === true) {
        return
      }
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
          return
      }
      this.processAnswer()
    }

    private turnListenerOn(){
      this.listenerOn = true
    }

    private turnListenerOff(){
      this.listenerOn = false
    }

    private async proofProposalPrompt(payload: any) {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.proofProposalTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.klm.acceptProofProposal(payload)
      }
    }

    private proofProposalListener() {
      this.klm.agent.events.on(ProofEventTypes.ProofStateChanged,
        async ({ payload }: ProofStateChangedEvent) => {
          if (payload.proofRecord.state === ProofState.ProposalReceived) {
            this.turnListenerOn()
            await this.proofProposalPrompt(payload)
            clearInterval(this.permissionTimeout)
            this.turnListenerOff()
            this.processAnswer()
          }
          return
        }
      )
    }

    async connection() {
      const title = Title.invitationTitle
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

export const runKlm = async () => {
  clear();
  console.log(figlet.textSync('KLM', { horizontalLayout: 'full' }));
  const klm = await KlmInquirer.build()
  klm.processAnswer()
}

runKlm()