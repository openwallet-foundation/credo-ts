import { clear } from 'console'
import { textSync } from 'figlet'

import { BaseInquirer } from './BaseInquirer'
import { credentialConfigurationsSupported, Issuer } from './Issuer'
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

  public constructor(issuer: Issuer) {
    super()
    this.issuer = issuer
  }

  public static async build(): Promise<IssuerInquirer> {
    const issuer = await Issuer.build()
    return new IssuerInquirer(issuer)
  }

  public async processAnswer() {
    const choice = await this.pickOne(Object.values(PromptOptions))

    switch (choice) {
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
    const credentialConfigurationIds = await this.pickMultiple(Object.keys(credentialConfigurationsSupported))
    const requireAuthorization = await this.inquireConfirmation('Require authorization?')
    const offerRequest = await this.issuer.createCredentialOffer({
      credentialConfigurationIds,
      requireAuthorization,
    })

    console.log(purpleText(`credential offer: '${offerRequest}'`))
  }

  public async exit() {
    if (await this.inquireConfirmation(Title.ConfirmTitle)) {
      await this.issuer.exit()
    }
  }

  public async restart() {
    const confirmed = await this.inquireConfirmation(Title.ConfirmTitle)
    if (confirmed) {
      await this.issuer.restart()
      await runIssuer()
    } else {
      await this.processAnswer()
    }
  }
}

void runIssuer()
