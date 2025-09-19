import type {
  OpenId4VciMetadata,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VpResolvedAuthorizationRequest,
} from '@credo-ts/openid4vc'

import { AskarModule } from '@credo-ts/askar'
import {
  DidJwk,
  DidKey,
  JwkDidCreateOptions,
  KeyDidCreateOptions,
  Kms,
  Mdoc,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2JwtVerifiableCredential,
  X509Module,
} from '@credo-ts/core'
import {
  OpenId4VcHolderModule,
  OpenId4VciAuthorizationFlow,
  authorizationCodeGrantIdentifier,
  preAuthorizedCodeGrantIdentifier,
} from '@credo-ts/openid4vc'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import { W3cV2SdJwtVerifiableCredential } from 'packages/core/src/modules/vc/sd-jwt-vc'
import { BaseAgent } from './BaseAgent'
import { Output, greenText } from './OutputClass'

function getOpenIdHolderModules(askarStorageConfig: AskarModuleConfigStoreOptions) {
  return {
    askar: new AskarModule({ askar, store: askarStorageConfig }),
    openId4VcHolder: new OpenId4VcHolderModule(),
    x509: new X509Module({
      getTrustedCertificatesForVerification: (_agentContext, { certificateChain, verification }) => {
        console.log(
          greenText(
            `dyncamically trusting certificate ${certificateChain[0].getIssuerNameField('C')} for verification of ${
              verification.type
            }`,
            true
          )
        )

        return [certificateChain[0].toString('pem')]
      },
    }),
  } as const
}

export class Holder extends BaseAgent<ReturnType<typeof getOpenIdHolderModules>> {
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
    return await this.agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)
  }

  public async resolveIssuerMetadata(credentialIssuer: string): Promise<OpenId4VciMetadata> {
    return await this.agent.modules.openId4VcHolder.resolveIssuerMetadata(credentialIssuer)
  }

  public async initiateAuthorization(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    credentialsToRequest: string[]
  ) {
    const grants = resolvedCredentialOffer.credentialOfferPayload.grants
    // TODO: extend iniateAuthorization in oid4vci lib? Or not?
    if (grants?.[preAuthorizedCodeGrantIdentifier]) {
      return {
        authorizationFlow: 'PreAuthorized',
        preAuthorizedCode: grants[preAuthorizedCodeGrantIdentifier]['pre-authorized_code'],
      } as const
    }
    if (resolvedCredentialOffer.credentialOfferPayload.grants?.[authorizationCodeGrantIdentifier]) {
      const resolvedAuthorizationRequest =
        await this.agent.modules.openId4VcHolder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
          clientId: this.client.clientId,
          redirectUri: this.client.redirectUri,
          scope: Object.entries(resolvedCredentialOffer.offeredCredentialConfigurations)
            .map(([id, value]) => (credentialsToRequest.includes(id) ? value.scope : undefined))
            .filter((v): v is string => Boolean(v)),
        })

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
    }
  ) {
    const tokenResponse = await this.agent.modules.openId4VcHolder.requestToken(
      options.code && options.clientId
        ? {
            resolvedCredentialOffer,
            clientId: options.clientId,
            codeVerifier: options.codeVerifier,
            code: options.code,
            redirectUri: options.redirectUri,
          }
        : {
            resolvedCredentialOffer,
            txCode: options.txCode,
          }
    )

    const credentialResponse = await this.agent.modules.openId4VcHolder.requestCredentials({
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
      credentialResponse.credentials.map((response) => {
        // TODO: handle batch issuance
        const credential = response.credentials[0]
        if (credential instanceof W3cJwtVerifiableCredential || credential instanceof W3cJsonLdVerifiableCredential) {
          return this.agent.w3cCredentials.storeCredential({ credential })
        }
        if (
          credential instanceof W3cV2JwtVerifiableCredential ||
          credential instanceof W3cV2SdJwtVerifiableCredential
        ) {
          return this.agent.w3cV2Credentials.storeCredential({ credential })
        }
        if (credential instanceof Mdoc) {
          return this.agent.mdoc.store(credential)
        }
        return this.agent.sdJwtVc.store(credential.compact)
      })
    )

    return storedCredentials
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest =
      await this.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(proofRequest)

    return resolvedProofRequest
  }

  public async acceptPresentationRequest(resolvedPresentationRequest: OpenId4VpResolvedAuthorizationRequest) {
    if (!resolvedPresentationRequest.presentationExchange && !resolvedPresentationRequest.dcql) {
      throw new Error('Missing presentation exchange or dcql on resolved authorization request')
    }

    const submissionResult = await this.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedPresentationRequest.authorizationRequestPayload,
      presentationExchange: resolvedPresentationRequest.presentationExchange
        ? {
            credentials: this.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
              resolvedPresentationRequest.presentationExchange.credentialsForRequest
            ),
          }
        : undefined,
      dcql: resolvedPresentationRequest.dcql
        ? {
            credentials: this.agent.modules.openId4VcHolder.selectCredentialsForDcqlRequest(
              resolvedPresentationRequest.dcql.queryResult
            ),
          }
        : undefined,
    })
    return submissionResult.serverResponse
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
