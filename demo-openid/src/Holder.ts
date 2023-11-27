import type { W3cCredentialRecord } from '@aries-framework/core'
import type {
  CredentialToRequest,
  PresentationRequest,
  PresentationSubmission,
} from '@aries-framework/openid4vc-holder'
import type { ResolvedCredentialOffer } from '@aries-framework/openid4vc-holder/build/issuance'
import type { ResolvedPresentationRequest } from '@aries-framework/openid4vc-holder/src/presentation'

import { AskarModule } from '@aries-framework/askar'
import { OpenId4VcHolderModule } from '@aries-framework/openid4vc-holder'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

function getOpenIdHolderModules() {
  return {
    askar: new AskarModule({ ariesAskar }),
    openId4VcHolder: new OpenId4VcHolderModule(),
  } as const
}

export class Holder extends BaseAgent<ReturnType<typeof getOpenIdHolderModules>> {
  private presentationRequest?: PresentationRequest
  private presentationSubmission?: PresentationSubmission

  public constructor(port: number, name: string) {
    super({ port, name, modules: getOpenIdHolderModules() })
  }

  public static async build(): Promise<Holder> {
    const holder = new Holder(3000, 'OpenId4VcHolder ' + Math.random().toString())
    await holder.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598e')

    return holder
  }

  public async resolveCredentialOffer(credentialOffer: string) {
    return await this.agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)
  }

  public async requestAndStoreCredential(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    credentialsToRequest: CredentialToRequest[]
  ) {
    const credentialRecords = await this.agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer,
      {
        credentialsToRequest,
        proofOfPossessionVerificationMethodResolver: async () => this.verificationMethod,
      }
    )

    const storedCredentials: W3cCredentialRecord[] = await Promise.all(
      credentialRecords.map(({ credential }) => this.agent.w3cCredentials.storeCredential({ credential }))
    )

    return storedCredentials
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest = await this.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    if (resolvedProofRequest.proofType === 'authentication')
      throw new Error('We only support presentation requests for now.')

    return resolvedProofRequest
  }

  public getProofRequestData() {
    if (!this.presentationRequest || !this.presentationSubmission)
      throw new Error('No proof request data set yet. You need to call resolveProofRequest first!')
    return {
      presentationRequest: this.presentationRequest,
      presentationSubmission: this.presentationSubmission,
    }
  }

  public async acceptPresentationRequest(
    resolvedPresentationReuest: ResolvedPresentationRequest,
    submissionEntryIndexes: number[]
  ) {
    const { presentationRequest, presentationSubmission } = resolvedPresentationReuest
    const submissionResult = await this.agent.modules.openId4VcHolder.acceptPresentationRequest(presentationRequest, {
      submission: presentationSubmission,
      submissionEntryIndexes,
    })

    return submissionResult.status
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
