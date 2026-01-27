import type { AskarModuleConfigStoreOptions } from '@credo-ts/askar'

import { AskarModule } from '@credo-ts/askar'
import {
  DidJwk,
  DidKey,
  type JwkDidCreateOptions,
  type KeyDidCreateOptions,
  Kms,
  MdocRecord,
  W3cCredentialRecord,
  W3cV2CredentialRecord,
  X509Module,
} from '@credo-ts/core'
import type {
  OpenId4VciDpopRequestOptions,
  OpenId4VciMetadata,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VpResolvedAuthorizationRequest,
} from '@credo-ts/openid4vc'
import {
  authorizationCodeGrantIdentifier,
  OpenId4VciAuthorizationFlow,
  OpenId4VcModule,
  preAuthorizedCodeGrantIdentifier,
} from '@credo-ts/openid4vc'
import { askar } from '@openwallet-foundation/askar-nodejs'
import type { Express } from 'express'
import { BaseAgent } from './BaseAgent'
import { greenText, Output } from './OutputClass'

function getOpenIdHolderModules(askarStorageConfig: AskarModuleConfigStoreOptions) {
  return (app: Express) => ({
    askar: new AskarModule({ askar, store: askarStorageConfig }),
    openid4vc: new OpenId4VcModule({
      app,
    }),
    x509: new X509Module({
      getTrustedCertificatesForVerification: (_agentContext, { certificateChain, verification }) => {
        console.log(
          greenText(
            `dynamically trusting certificate ${certificateChain[0].getIssuerNameField('C')} for verification of ${
              verification.type
            }`,
            true
          )
        )

        return [certificateChain[0].toString('pem')]
      },
    }),
  })
}

export class Holder extends BaseAgent<ReturnType<ReturnType<typeof getOpenIdHolderModules>>> {
  public client = {
    clientId: 'wallet',
    redirectUri: 'http://localhost:3000/redirect',
  }

  public constructor(port: number, name: string) {
    super({
      port,
      name,
      modules: getOpenIdHolderModules({
        id: name,
        key: name,
      }),
    })
  }

  public static async build(): Promise<Holder> {
    const holder = new Holder(3000, `OpenId4VcHolder ${Math.random().toString()}`)
    await holder.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598e')

    return holder
  }

  public async resolveCredentialOffer(credentialOffer: string) {
    return await this.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)
  }

  public async resolveIssuerMetadata(credentialIssuer: string): Promise<OpenId4VciMetadata> {
    return await this.agent.openid4vc.holder.resolveIssuerMetadata(credentialIssuer)
  }

  public async initiateAuthorization(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    credentialsToRequest: string[]
  ) {
    const grants = resolvedCredentialOffer.credentialOfferPayload.grants
    // TODO: extend initiateAuthorization in oid4vci lib? Or not?
    if (grants?.[preAuthorizedCodeGrantIdentifier]) {
      return {
        authorizationFlow: 'PreAuthorized',
        preAuthorizedCode: grants[preAuthorizedCodeGrantIdentifier]['pre-authorized_code'],
      } as const
    }
    if (resolvedCredentialOffer.credentialOfferPayload.grants?.[authorizationCodeGrantIdentifier]) {
      const resolvedAuthorizationRequest = await this.agent.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
        resolvedCredentialOffer,
        {
          clientId: this.client.clientId,
          redirectUri: this.client.redirectUri,
          scope: Object.entries(resolvedCredentialOffer.offeredCredentialConfigurations)
            .map(([id, value]) => (credentialsToRequest.includes(id) ? value.scope : undefined))
            .filter((v): v is string => Boolean(v)),
        }
      )

      if (resolvedAuthorizationRequest.authorizationFlow === OpenId4VciAuthorizationFlow.PresentationDuringIssuance) {
        return {
          ...resolvedAuthorizationRequest,
          authorizationFlow: `${OpenId4VciAuthorizationFlow.PresentationDuringIssuance}`,
        } as const
      }
      return {
        ...resolvedAuthorizationRequest,
        authorizationFlow: `${OpenId4VciAuthorizationFlow.Oauth2Redirect}`,
      } as const
    }

    throw new Error('Unsupported grant type')
  }

  public async requestAndStoreCredentials(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    options: {
      clientId?: string
      codeVerifier?: string
      credentialsToRequest: string[]
      code?: string
      redirectUri?: string
      txCode?: string
      dpop?: OpenId4VciDpopRequestOptions
    }
  ) {
    const tokenResponse = await this.agent.openid4vc.holder.requestToken(
      options.code && options.clientId
        ? {
            resolvedCredentialOffer,
            clientId: options.clientId,
            codeVerifier: options.codeVerifier,
            code: options.code,
            redirectUri: options.redirectUri,
            dpop: options.dpop,
          }
        : {
            resolvedCredentialOffer,
            txCode: options.txCode,
            dpop: options.dpop,
          }
    )

    const credentialResponse = await this.agent.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      clientId: options.clientId,
      credentialConfigurationIds: options.credentialsToRequest,
      credentialBindingResolver: async ({ supportedDidMethods, supportsAllDidMethods, proofTypes }) => {
        const key = await this.agent.kms.createKeyForSignatureAlgorithm({
          algorithm: proofTypes.jwt?.supportedSignatureAlgorithms[0] ?? 'EdDSA',
        })
        const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)

        if (supportsAllDidMethods || supportedDidMethods?.includes('did:key')) {
          await this.agent.dids.create<KeyDidCreateOptions>({
            method: 'key',
            options: {
              keyId: key.keyId,
            },
          })
          const didKey = new DidKey(publicJwk)

          return {
            method: 'did',
            didUrls: [`${didKey.did}#${didKey.publicJwk.fingerprint}`],
          }
        }
        if (supportedDidMethods?.includes('did:jwk')) {
          const didJwk = DidJwk.fromPublicJwk(publicJwk)
          await this.agent.dids.create<JwkDidCreateOptions>({
            method: 'jwk',
            options: {
              keyId: key.keyId,
            },
          })

          return {
            method: 'did',
            didUrls: [`${didJwk.did}#0`],
          }
        }

        // We fall back on jwk binding
        return {
          method: 'jwk',
          keys: [publicJwk],
        }
      },
      ...tokenResponse,
    })

    const storedCredentials = await Promise.all(
      credentialResponse.credentials.map((credential) => {
        if (credential.record instanceof W3cCredentialRecord) {
          return this.agent.w3cCredentials.store({ record: credential.record })
        }
        if (credential.record instanceof W3cV2CredentialRecord) {
          return this.agent.w3cV2Credentials.store({ record: credential.record })
        }
        if (credential.record instanceof MdocRecord) {
          return this.agent.mdoc.store({ record: credential.record })
        }
        return this.agent.sdJwtVc.store({
          record: credential.record,
        })
      })
    )

    return storedCredentials
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest = await this.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(proofRequest)

    return resolvedProofRequest
  }

  public async acceptPresentationRequest(resolvedPresentationRequest: OpenId4VpResolvedAuthorizationRequest) {
    if (!resolvedPresentationRequest.presentationExchange && !resolvedPresentationRequest.dcql) {
      throw new Error('Missing presentation exchange or dcql on resolved authorization request')
    }

    const submissionResult = await this.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedPresentationRequest.authorizationRequestPayload,
      presentationExchange: resolvedPresentationRequest.presentationExchange
        ? {
            credentials: this.agent.openid4vc.holder.selectCredentialsForPresentationExchangeRequest(
              resolvedPresentationRequest.presentationExchange.credentialsForRequest
            ),
          }
        : undefined,
      dcql: resolvedPresentationRequest.dcql
        ? {
            credentials: this.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
              resolvedPresentationRequest.dcql.queryResult
            ),
          }
        : undefined,
    })
    return submissionResult
  }

  public async exit() {
    console.log(Output.Exit)
    await this.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.shutdown()
  }
}
