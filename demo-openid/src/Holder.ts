import type {
  OfferedCredentialWithMetadata,
  ResolvedPresentationRequest,
  ResolvedCredentialOffer,
} from '@aries-framework/openid4vc'

import { AskarModule } from '@aries-framework/askar'
import { W3cJwtVerifiableCredential, W3cJsonLdVerifiableCredential } from '@aries-framework/core'
import { OpenId4VcHolderModule } from '@aries-framework/openid4vc'
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
    const credentials = await this.agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer,
      {
        credentialsToRequest,
        // TODO: add jwk support for holder binding
        credentialBindingResolver: async () => ({
          method: 'did',
          didUrl: this.verificationMethod.id,
        }),
      }
    )

    const storedCredentials = await Promise.all(
      credentials.map((credential) => {
        if (credential instanceof W3cJwtVerifiableCredential || credential instanceof W3cJsonLdVerifiableCredential) {
          return this.agent.w3cCredentials.storeCredential({ credential })
        } else {
          return this.agent.sdJwtVc.store(credential.compact)
        }
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
    resolvedPresentationRequest: ResolvedPresentationRequest,
    submissionEntryIndexes: number[]
  ) {
    const { presentationRequest, presentationSubmission } = resolvedPresentationRequest
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
