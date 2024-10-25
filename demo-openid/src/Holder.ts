import type { OpenId4VciResolvedCredentialOffer, OpenId4VcSiopResolvedAuthorizationRequest } from '@credo-ts/openid4vc'

import { AskarModule } from '@credo-ts/askar'
import {
  W3cJwtVerifiableCredential,
  W3cJsonLdVerifiableCredential,
  DifPresentationExchangeService,
  Mdoc,
} from '@credo-ts/core'
import { OpenId4VcHolderModule } from '@credo-ts/openid4vc'
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

    // Set trusted issuer certificates. Required fro verifying mdoc credentials
    const trustedCertificates: string[] = []
    await holder.agent.x509.setTrustedCertificates(
      trustedCertificates.length === 0 ? undefined : (trustedCertificates as [string, ...string[]])
    )

    return holder
  }

  public async resolveCredentialOffer(credentialOffer: string) {
    return await this.agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)
  }

  public async requestAndStoreCredentials(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    credentialsToRequest: string[]
  ) {
    const tokenResponse = await this.agent.modules.openId4VcHolder.requestToken({ resolvedCredentialOffer })
    const credentialResponse = await this.agent.modules.openId4VcHolder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponse,
      // TODO: add jwk support for holder binding
      credentialsToRequest,
      credentialBindingResolver: async () => ({
        method: 'did',
        didUrl: this.verificationMethod.id,
      }),
    })

    const storedCredentials = await Promise.all(
      credentialResponse.map((response) => {
        const credential = response.credential
        if (credential instanceof W3cJwtVerifiableCredential || credential instanceof W3cJsonLdVerifiableCredential) {
          return this.agent.w3cCredentials.storeCredential({ credential })
        } else if (credential instanceof Mdoc) {
          return this.agent.mdoc.store(credential)
        } else {
          return this.agent.sdJwtVc.store(credential.compact)
        }
      })
    )

    return storedCredentials
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest = await this.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(proofRequest)

    return resolvedProofRequest
  }

  public async acceptPresentationRequest(resolvedPresentationRequest: OpenId4VcSiopResolvedAuthorizationRequest) {
    const presentationExchangeService = this.agent.dependencyManager.resolve(DifPresentationExchangeService)

    if (!resolvedPresentationRequest.presentationExchange) {
      throw new Error('Missing presentation exchange on resolved authorization request')
    }

    const submissionResult = await this.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
      authorizationRequest: resolvedPresentationRequest.authorizationRequest,
      presentationExchange: {
        credentials: presentationExchangeService.selectCredentialsForRequest(
          resolvedPresentationRequest.presentationExchange.credentialsForRequest
        ),
      },
    })

    return submissionResult.serverResponse
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
