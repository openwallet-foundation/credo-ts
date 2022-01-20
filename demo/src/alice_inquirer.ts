import { clear } from 'console'
import figlet from 'figlet'
import inquirer from 'inquirer'
import { Alice } from './alice'
import { BaseInquirer } from './base_inquirer'
import { Listener } from './listener'
import { Title } from './output_class'

enum PromptOptions {
  Connection = 'setup connection',
  Message = 'send message',
  Exit = 'exit',
  Restart = 'restart',
}

export class AliceInquirer extends BaseInquirer {
  alice: Alice
  promptOptionsString: string[]
  listener: Listener

  constructor(alice: Alice) {
    super()
    this.alice = alice
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.alice.agent, this.alice.name)
  }

  public static async build(): Promise<AliceInquirer> {
    const alice = await Alice.build()
    return new AliceInquirer(alice)
  }

  async getPromptChoice() {
    return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
  }

  async processAnswer() {
    const choice = await this.getPromptChoice()
    if (this.listener.on === true) {
      return
    }
    switch (choice.options) {
      case PromptOptions.Connection:
        await this.connection()
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
    if (confirm.options === 'no') {
      await this.alice.agent.credentials.declineOffer(payload.credentialRecord.id)
    } else if (confirm.options === 'yes') {
      await this.alice.acceptCredentialOffer(payload)
    }
  }

  async acceptProofRequest(payload: any) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.proofRequestTitle)])
    if (confirm.options === 'no') {
      await this.alice.agent.proofs.declineRequest(payload.proofRecord.id)
    } else if (confirm.options === 'yes') {
      await this.alice.acceptProofRequest(payload)
    }
  }

  async connection() {
    await this.alice.setupConnection()
    this.listener.credentialOfferListener(this.alice, this)
    this.listener.proofRequestListener(this.alice, this)
  }

  async message() {
    const message = await this.inquireMessage()
    if (message === null) {
      return
    }
    this.alice.sendMessage(message)
  }

  async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === 'no') {
      return
    } else if (confirm.options === 'yes') {
      await this.alice.exit()
    }
  }

  async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === 'no') {
      this.processAnswer()
      return
    } else if (confirm.options === 'yes') {
      await this.alice.restart()
    }
  }
}

export const runAlice = async () => {
  clear()
  console.log(figlet.textSync('Alice', { horizontalLayout: 'full' }))
  const alice = await AliceInquirer.build()
  alice.processAnswer()
}

runAlice()
