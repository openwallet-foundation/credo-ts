import type { CredentialRecord, ProofRecord } from '@aries-framework/core'

import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { Alice } from './Alice'
import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runAlice = async () => {
  clear()
  console.log(textSync('Alice', { horizontalLayout: 'full' }))
  const alice = await AliceInquirer.build()
  alice.processAnswer()
}

enum PromptOptions {
  Connection = 'Create connection invitation',
  Message = 'Send message',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class AliceInquirer extends BaseInquirer {
  public alice: Alice
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(alice: Alice) {
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

  private async getPromptChoice() {
    return await inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
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

  public async acceptCredentialOffer(credentialRecord: CredentialRecord) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.credentialOfferTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.alice.agent.credentials.declineOffer(credentialRecord.id)
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alice.acceptCredentialOffer(credentialRecord)
    }
  }

  public async acceptProofRequest(proofRecord: ProofRecord) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.proofRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.alice.agent.proofs.declineRequest(proofRecord.id)
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alice.acceptProofRequest(proofRecord)
    }
  }

  public async connection() {
    await this.alice.setupConnection()
    if (this.alice.connected === false) {
      return
    }
    this.listener.credentialOfferListener(this.alice, this)
    this.listener.proofRequestListener(this.alice, this)
  }

  public async message() {
    const message = await this.inquireMessage()
    if (message === null) {
      return
    }
    this.alice.sendMessage(message)
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alice.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alice.restart()
      runAlice()
    }
  }
}

runAlice()
