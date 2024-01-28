import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Issuer, credentialsSupported } from './Issuer'
import { Title, purpleText } from './OutputClass'

export const runIssuer = async () => {
  clear()
  console.log(textSync('Issuer', { horizontalLayout: 'full' }))
  const issuer = await IssuerInquirer.build()
  await issuer.processAnswer()
}

enum PromptOptions {
  CreateCredentialOffer = 'Create a credential offer',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class IssuerInquirer extends BaseInquirer {
  public issuer: Issuer
  public promptOptionsString: string[]

  public constructor(issuer: Issuer) {
    super()
    this.issuer = issuer
    this.promptOptionsString = Object.values(PromptOptions)
  }

  public static async build(): Promise<IssuerInquirer> {
    const issuer = await Issuer.build()
    return new IssuerInquirer(issuer)
  }

  private async getPromptChoice() {
    return prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()

    switch (choice.options) {
      case PromptOptions.CreateCredentialOffer:
        await this.createCredentialOffer()
        break
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async createCredentialOffer() {
    const choice = await prompt([this.inquireOptions(credentialsSupported.map((credential) => credential.id))])
    const offeredCredential = credentialsSupported.find((credential) => credential.id === choice.options)
    if (!offeredCredential) throw new Error(`No credential of type ${choice.options} found, that can be offered.`)
    const offerRequest = await this.issuer.createCredentialOffer([offeredCredential.id])

    console.log(purpleText(`credential offer: '${offerRequest}'`))
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.issuer.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.issuer.restart()
      await runIssuer()
    }
  }
}

void runIssuer()
