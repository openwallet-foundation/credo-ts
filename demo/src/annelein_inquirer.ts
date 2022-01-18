import { clear } from "console";
import figlet from "figlet";
import inquirer from "inquirer";
import { Annelein } from "./annelein"
import { BaseInquirer } from "./base_inquirer"
import { Listener } from "./listener";
import { Title } from "./output_class";

enum PromptOptions {
    Connection = "setup connection",
    Proof = "propose proof",
    Message = "send message",
    Exit = "exit",
    Restart = "restart"
  }

export class AnneleinInquirer extends BaseInquirer{
    annelein: Annelein
    promptOptionsString: string[]
    listener: Listener

    constructor(annelein: Annelein) {
      super()
      this.annelein = annelein
      this.listener = new Listener()
      this.promptOptionsString = Object.values(PromptOptions)
      this.listener.messageListener(this.annelein.agent, this.annelein.name)
    }

    public static async build(): Promise<AnneleinInquirer> {
      const annelein = await Annelein.build()
      return new AnneleinInquirer(annelein)
    }

    async getPromptChoice() {
      return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    }

    async processAnswer() {
      const choice = await this.getPromptChoice()
      if (this.listener.on === true){
        return
      }
      switch(choice){
        case PromptOptions.Connection:
            await this.connection()
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

    async acceptCredentialOffer(payload: any) {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.credentialOfferTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.annelein.acceptCredentialOffer(payload)
      }
    }

    async acceptProofRequest(payload: any) {
      const confirm = await inquirer.prompt([this.inquireConfirmation(Title.proofRequestTitle)])
      if (confirm.options === 'no'){
        return
      } else if (confirm.options === 'yes'){
        await this.annelein.acceptProofRequest(payload)
      }
    }

    async connection() {
      await this.annelein.setupConnection()
      this.listener.credentialOfferListener(this.annelein, this)
      this.listener.proofRequestListener(this.annelein, this)
    }

    async proof() {
      this.listener.proposalSentListener(this.annelein)
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