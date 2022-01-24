import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Faber } from './Faber'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runFaber = async () => {
  clear()
  console.log(textSync('Faber', { horizontalLayout: 'full' }))
  const faber = await FaberInquirer.build()
  faber.processAnswer()
}

enum PromptOptions {
  Connection = 'Receive connection invitation',
  Credential = 'Offer credential',
  Proof = 'Request proof',
  Message = 'Send message',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class FaberInquirer extends BaseInquirer {
  public faber: Faber
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(faber: Faber) {
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

  private async getPromptChoice() {
    const prompt = inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
    return prompt
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
      case PromptOptions.Credential:
        await this.credential()
        return
      case PromptOptions.Proof:
        await this.proof()
        return
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

  public async connection() {
    const title = Title.invitationTitle
    const getUrl = await inquirer.prompt([this.inquireInput(title)])
    await this.faber.acceptConnection(getUrl.input)
  }

  public async exitUseCase(title: string) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(title)])
    if (confirm.options === ConfirmOptions.No) {
      return false
    } else if (confirm.options === ConfirmOptions.Yes) {
      return true
    }
  }

  public async credential() {
    await this.faber.issueCredential()
    const title = `Is the credential offer accepted?`
    this.listener.newAcceptedPrompt(title, this.faber, this)
  }

  public async proof() {
    await this.faber.sendProofRequest()
    const title = `Is the proof request accepted?`
    this.listener.newAcceptedPrompt(title, this.faber, this)
  }

  public async message() {
    const message = await this.inquireMessage()
    if (message === null) {
      return
    }
    this.faber.sendMessage(message)
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.faber.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.confirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.faber.restart()
      runFaber()
    }
  }
}

runFaber()
