import type { W3cCredentialRecord } from '@aries-framework/core'
import type {
  OfferedCredentialWithMetadata,
  ResolvedPresentationRequest,
  ResolvedCredentialOffer,
} from '@aries-framework/openid4vc-holder'

import { AskarModule } from '@aries-framework/askar'
import { OpenId4VcHolderModule } from '@aries-framework/openid4vc-holder'
import { SdJwtVcModule, type SdJwtVcRecord } from '@aries-framework/sd-jwt-vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

function getOpenIdHolderModules() {
  return {
    askar: new AskarModule({ ariesAskar }),
    openId4VcHolder: new OpenId4VcHolderModule(),
    sdJwtVc: new SdJwtVcModule(),
  } as const
}

export class Holder extends BaseAgent<ReturnType<typeof getOpenIdHolderModules>> {
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

  public async requestAndStoreCredentials(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    credentialsToRequest: OfferedCredentialWithMetadata[]
  ) {
    const credentialRecords = await this.agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer,
      {
        credentialsToRequest,
        proofOfPossessionVerificationMethodResolver: async () => this.verificationMethod,
      }
    )

    const storedCredentials: (W3cCredentialRecord | SdJwtVcRecord)[] = await Promise.all(
      credentialRecords.map((record) => {
        if (record.type === 'W3cCredentialRecord') {
          return this.agent.w3cCredentials.storeCredential({ credential: record.credential })
        }
        return this.agent.modules.sdJwtVc.storeCredential2(record)
      })
    )

    return storedCredentials
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest = await this.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    if (resolvedProofRequest.proofType === 'authentication')
      throw new Error('We only support presentation requests for now.')

    return resolvedProofRequest
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
