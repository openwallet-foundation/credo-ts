import type { ResolvedCredentialOffer, ResolvedPresentationRequest } from '@aries-framework/openid4vc-holder'

import { OpenIdCredentialFormatProfile } from '@aries-framework/openid4vc-issuer'
import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Holder } from './Holder'
import { Title, greenText, redText } from './OutputClass'

export const runHolder = async () => {
  clear()
  console.log(textSync('Holder', { horizontalLayout: 'full' }))
  const holder = await HolderInquirer.build()
  await holder.processAnswer()
}

enum PromptOptions {
  ResolveCredentialOffer = 'Resolve a credential offer.',
  RequestCredential = 'Accept the credential offer.',
  ResolveProofRequest = 'Resolve a proof request.',
  AcceptPresentationRequest = 'Accept the presentation request.',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class HolderInquirer extends BaseInquirer {
  public holder: Holder
  public resolvedCredentialOffer?: ResolvedCredentialOffer
  public resolvedPresentationRequest?: ResolvedPresentationRequest

  public constructor(holder: Holder) {
    super()
    this.holder = holder
  }

  public static async build(): Promise<HolderInquirer> {
    const holder = await Holder.build()
    return new HolderInquirer(holder)
  }

  private async getPromptChoice() {
    const promptOptions = [PromptOptions.ResolveCredentialOffer, PromptOptions.ResolveProofRequest]

    if (this.resolvedCredentialOffer) promptOptions.push(PromptOptions.RequestCredential)
    if (this.resolvedPresentationRequest) promptOptions.push(PromptOptions.AcceptPresentationRequest)

    return prompt([this.inquireOptions(promptOptions.map((o) => o.valueOf()))])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()

    switch (choice.options) {
      case PromptOptions.ResolveCredentialOffer:
        await this.resolveCredentialOffer()
        break
      case PromptOptions.RequestCredential:
        await this.requestCredential()
        break
      case PromptOptions.ResolveProofRequest:
        await this.resolveProofRequest()
        break
      case PromptOptions.AcceptPresentationRequest:
        await this.acceptPresentationRequest()
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

  public async exitUseCase(title: string) {
    const confirm = await prompt([this.inquireConfirmation(title)])
    if (confirm.options === ConfirmOptions.No) {
      return false
    } else if (confirm.options === ConfirmOptions.Yes) {
      return true
    }
  }

  public async resolveCredentialOffer() {
    const credentialOffer = await prompt([this.inquireInput('Enter credential offer: ')])
    const resolvedCredentialOffer = await this.holder.resolveCredentialOffer(credentialOffer.input)
    this.resolvedCredentialOffer = resolvedCredentialOffer

    console.log(greenText(`Received credential offer for the following credentials.`))
    console.log(
      greenText(resolvedCredentialOffer.offeredCredentials.map((credential) => credential.types.join(', ')).join('\n'))
    )
  }

  public async requestCredential() {
    if (!this.resolvedCredentialOffer) {
      throw new Error('No credential offer resolved yet.')
    }

    const credentialsThatCanBeRequested = this.resolvedCredentialOffer.offeredCredentials.map((credential) =>
      credential.types.join(', ')
    )

    const choice = await prompt([this.inquireOptions(credentialsThatCanBeRequested)])

    const credentialToRequest = this.resolvedCredentialOffer.offeredCredentials.find(
      (credential) => credential.types.join(', ') == choice.options
    )
    if (!credentialToRequest) throw new Error('Credential to request not found.')

    console.log(greenText(`Requesting the following credential '${credentialToRequest.types.join(', ')}'`))

    const credentials = await this.holder.requestAndStoreCredentials(
      this.resolvedCredentialOffer,
      this.resolvedCredentialOffer.offeredCredentials
    )

    console.log(greenText(`Received and stored the following credentials.`))
    console.log(
      greenText(
        credentials
          .map((credential) => {
            if (credential.type === 'W3cCredentialRecord')
              return credential.credential.type.join(', ') + `, CredentialType: 'W3CVerifiableCredential'`
            else return credential.sdJwtVc.payload.type + `, CredentialType: 'SdJwtVc'`
          })
          .join('\n')
      )
    )
  }

  public async resolveProofRequest() {
    const proofRequestUri = await prompt([this.inquireInput('Enter proof request: ')])
    this.resolvedPresentationRequest = await this.holder.resolveProofRequest(proofRequestUri.input)

    const presentationDefinition =
      this.resolvedPresentationRequest.presentationRequest.presentationDefinitions[0].definition

    console.log(greenText(`Presentation Purpose: '${presentationDefinition.purpose}'`))

    if (this.resolvedPresentationRequest.presentationSubmission.areRequirementsSatisfied) {
      console.log(greenText(`All requirements for creating the presentation are satisfied.`))
    } else {
      console.log(redText(`No credentials available that satisfy the proof request.`))
    }
  }

  public async acceptPresentationRequest() {
    if (!this.resolvedPresentationRequest) throw new Error('No presentation request resolved yet.')

    // we know that only one credential is in the wallet and it satisfies the proof request.
    // The submission entry index for this credential is 0.
    const credential =
      this.resolvedPresentationRequest.presentationSubmission.requirements[0].submissionEntry[0]
        .verifiableCredentials[0]
    const submissionEntryIndexes = [0]

    console.log(greenText(`Accepting the presentation request, with the following credential.`))
    console.log(greenText(credential.credential.type.join(', ')))

    const status = await this.holder.acceptPresentationRequest(this.resolvedPresentationRequest, submissionEntryIndexes)

    if (status >= 200 && status < 300) {
      console.log(`received success status code '${status}'`)
    } else {
      console.log(`received error status code '${status}'`)
    }
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.holder.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.holder.restart()
      await runHolder()
    }
  }
}

void runHolder()
