import { clear } from 'console'
import { textSync } from 'figlet'

import { BaseInquirer } from './BaseInquirer'
import { credentialConfigurationsSupported, Issuer } from './Issuer'
import { Title, greenText, purpleText, redText } from './OutputClass'

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
    let credentialConfigurationIds = await this.pickMultiple(Object.keys(credentialConfigurationsSupported))
    while (credentialConfigurationIds.length === 0) {
      console.log(redText('Pick at least one', true))
      credentialConfigurationIds = await this.pickMultiple(Object.keys(credentialConfigurationsSupported))
    }

    const authorizationMethod = await this.pickOne(
      ['Transaction Code', 'Browser', 'Presentation', 'None'],
      'Authorization method'
    )
    const { credentialOffer, issuanceSession } = await this.issuer.createCredentialOffer({
      credentialConfigurationIds,
      requireAuthorization:
        authorizationMethod === 'Browser'
          ? 'browser'
          : authorizationMethod === 'Presentation'
          ? 'presentation'
          : undefined,
      requirePin: authorizationMethod === 'Transaction Code',
    })

    console.log(purpleText(`credential offer: '${credentialOffer}'`, true))

    if (issuanceSession.userPin) {
      console.log(greenText(`\nEnter PIN ${issuanceSession.userPin} when asked`, true))
    }
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
