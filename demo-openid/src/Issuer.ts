import type { DidKey } from '@credo-ts/core'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VcCredentialHolderDidBinding,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciSignMdocCredentials,
  OpenId4VciSignSdJwtCredentials,
  OpenId4VciSignW3cCredentials,
  OpenId4VcIssuerRecord,
  OpenId4VcVerifierRecord,
} from '@credo-ts/openid4vc'

import { AskarModule } from '@credo-ts/askar'
import {
  ClaimFormat,
  parseDid,
  CredoError,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
  X509Service,
  KeyType,
  X509ModuleConfig,
  utils,
  TypedArrayEncoder,
  JsonTransformer,
} from '@credo-ts/core'
import {
  OpenId4VcIssuerModule,
  OpenId4VcVerifierApi,
  OpenId4VcVerifierModule,
  OpenId4VciCredentialFormatProfile,
} from '@credo-ts/openid4vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

const PROVIDER_HOST = process.env.PROVIDER_HOST ?? 'http://localhost:3042'
const ISSUER_HOST = process.env.ISSUER_HOST ?? 'http://localhost:2000'

export const credentialConfigurationsSupported = {
  PresentationAuthorization: {
    format: OpenId4VciCredentialFormatProfile.SdJwtVc,
    vct: 'PresentationAuthorization',
    scope: 'openid4vc:credential:PresentationAuthorization',
    cryptographic_binding_methods_supported: ['jwk', 'did:key', 'did:jwk'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
  },
  'UniversityDegreeCredential-jwtvcjson': {
    format: OpenId4VciCredentialFormatProfile.JwtVcJson,
    scope: 'openid4vc:credential:UniversityDegreeCredential-jwtvcjson',
    // TODO: we should validate this against what is supported by credo
    // as otherwise it's very easy to create invalid configurations?
    cryptographic_binding_methods_supported: ['did:key', 'did:jwk'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
    credential_definition: {
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    },
  },
  'UniversityDegreeCredential-sdjwt': {
    format: OpenId4VciCredentialFormatProfile.SdJwtVc,
    vct: 'UniversityDegreeCredential',
    scope: 'openid4vc:credential:OpenBadgeCredential-sdjwt',
    cryptographic_binding_methods_supported: ['jwk'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
  },
  'UniversityDegreeCredential-mdoc': {
    format: OpenId4VciCredentialFormatProfile.MsoMdoc,
    doctype: 'UniversityDegreeCredential',
    scope: 'openid4vc:credential:OpenBadgeCredential-mdoc',
    cryptographic_binding_methods_supported: ['jwk'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
  },
} satisfies OpenId4VciCredentialConfigurationsSupportedWithFormats

function getCredentialRequestToCredentialMapper({
  issuerDidKey,
}: {
  issuerDidKey: DidKey
}): OpenId4VciCredentialRequestToCredentialMapper {
  return async ({
    holderBindings,
    credentialConfigurationIds,
    credentialConfigurationsSupported: supported,
    agentContext,
    authorization,
  }) => {
    const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    if (trustedCertificates?.length !== 1) {
      throw new Error(`Expected exactly one trusted certificate. Received ${trustedCertificates?.length}.`)
    }

    const credentialConfigurationId = credentialConfigurationIds[0]
    const credentialConfiguration = supported[credentialConfigurationId]

    if (credentialConfigurationId === 'PresentationAuthorization') {
      return {
        credentialConfigurationId,
        format: ClaimFormat.SdJwtVc,
        credentials: holderBindings.map((holderBinding) => ({
          payload: {
            vct: credentialConfiguration.vct,
            authorized_user: authorization.accessToken.payload.sub,
          },
          holder: holderBinding,
          issuer:
            holderBindings[0].method === 'did'
              ? {
                  method: 'did',
                  didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
                }
              : { method: 'x5c', x5c: [trustedCertificates[0]], issuer: ISSUER_HOST },
        })),
      } satisfies OpenId4VciSignSdJwtCredentials
    }

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
      holderBindings.forEach((holderBinding) => assertDidBasedHolderBinding(holderBinding))

      return {
        credentialConfigurationId,
        format: ClaimFormat.JwtVc,
        credentials: holderBindings.map((holderBinding) => {
          assertDidBasedHolderBinding(holderBinding)
          return {
            credential: new W3cCredential({
              type: credentialConfiguration.credential_definition.type,
              issuer: new W3cIssuer({
                id: issuerDidKey.did,
              }),
              credentialSubject: JsonTransformer.fromJSON(
                {
                  id: parseDid(holderBinding.didUrl).did,
                  authorizedUser: authorization.accessToken.payload.sub,
                },
                W3cCredentialSubject
              ),
              issuanceDate: w3cDate(Date.now()),
            }),
            verificationMethod: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
          }
        }),
      } satisfies OpenId4VciSignW3cCredentials
    }

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
      return {
        credentialConfigurationId,
        format: ClaimFormat.SdJwtVc,
        credentials: holderBindings.map((holderBinding) => ({
          payload: {
            vct: credentialConfiguration.vct,
            university: 'innsbruck',
            degree: 'bachelor',
            authorized_user: authorization.accessToken.payload.sub,
          },
          holder: holderBinding,
          issuer: {
            method: 'did',
            didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
          },
          disclosureFrame: { _sd: ['university', 'degree', 'authorized_user'] },
        })),
      } satisfies OpenId4VciSignSdJwtCredentials
    }

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
      return {
        credentialConfigurationId,
        format: ClaimFormat.MsoMdoc,
        credentials: holderBindings.map((holderBinding) => ({
          issuerCertificate: trustedCertificates[0],
          holderKey: holderBinding.key,
          namespaces: {
            'Leopold-Franzens-University': {
              degree: 'bachelor',
              authorized_user: authorization.accessToken.payload.sub,
            },
          },
          docType: credentialConfiguration.doctype,
        })),
      } satisfies OpenId4VciSignMdocCredentials
    }

    throw new Error('Invalid request')
  }
}

export class Issuer extends BaseAgent<{
  askar: AskarModule
  openId4VcIssuer: OpenId4VcIssuerModule
  openId4VcVerifier: OpenId4VcVerifierModule
}> {
  public issuerRecord!: OpenId4VcIssuerRecord
  public verifierRecord!: OpenId4VcVerifierRecord

  public constructor(url: string, port: number, name: string) {
    const openId4VciRouter = Router()
    const openId4VpRouter = Router()

    super({
      port,
      name,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: `${url}/oid4vp`,
          router: openId4VpRouter,
        }),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: `${url}/oid4vci`,
          router: openId4VciRouter,
          credentialRequestToCredentialMapper: (...args) =>
            getCredentialRequestToCredentialMapper({ issuerDidKey: this.didKey })(...args),
          getVerificationSessionForIssuanceSessionAuthorization: async ({ agentContext, scopes }) => {
            const verifierApi = agentContext.dependencyManager.resolve(OpenId4VcVerifierApi)
            const authorizationRequest = await verifierApi.createAuthorizationRequest({
              verifierId: this.verifierRecord.verifierId,
              requestSigner: {
                method: 'did',
                didUrl: `${this.didKey.did}#${this.didKey.key.fingerprint}`,
              },
              responseMode: 'direct_post.jwt',
              presentationExchange: {
                definition: {
                  id: '18e2c9c3-1722-4393-a558-f0ce1e32c4ec',
                  input_descriptors: [
                    {
                      id: '16f00df5-67f1-47e6-81b1-bd3e3743f84c',
                      constraints: {
                        fields: [
                          {
                            path: ['$.vct'],
                            filter: {
                              type: 'string',
                              const: credentialConfigurationsSupported.PresentationAuthorization.vct,
                            },
                          },
                        ],
                      },
                    },
                  ],
                  name: 'Presentation Authorization',
                  purpose: `To issue the requested credentials, we need to verify your 'Presentation Authorization' credential`,
                },
              },
            })

            return {
              scopes,
              ...authorizationRequest,
            }
          },
        }),
      },
    })

    this.app.use('/oid4vci', openId4VciRouter)
    this.app.use('/oid4vp', openId4VpRouter)
  }

  public static async build(): Promise<Issuer> {
    const issuer = new Issuer(ISSUER_HOST, 2000, 'OpenId4VcIssuer ' + Math.random().toString())
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598f')

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(issuer.agent.context, {
      key: await issuer.agent.context.wallet.createKey({
        keyType: KeyType.P256,
        seed: TypedArrayEncoder.fromString('e5f18b10cd15cdb76818bc6ae8b71eb475e6eac76875ed085d3962239bbcf42f'),
      }),
      notBefore: new Date('2000-01-01'),
      notAfter: new Date('2050-01-01'),
      extensions: [[{ type: 'dns', value: ISSUER_HOST.replace('https://', '').replace('http://', '') }]],
      name: 'C=DE',
    })

    const issuerCertficicate = selfSignedCertificate.toString('base64url')
    await issuer.agent.x509.setTrustedCertificates([issuerCertficicate])
    console.log('Set the following certficate for the holder to verify mdoc credentials.')
    console.log(issuerCertficicate)

    issuer.verifierRecord = await issuer.agent.modules.openId4VcVerifier.createVerifier({
      verifierId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
    })
    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
      credentialConfigurationsSupported,
      authorizationServerConfigs: [
        {
          issuer: PROVIDER_HOST,
          clientAuthentication: {
            clientId: 'issuer-server',
            clientSecret: 'issuer-server',
          },
        },
      ],
    })

    const issuerMetadata = await issuer.agent.modules.openId4VcIssuer.getIssuerMetadata(issuer.issuerRecord.issuerId)
    console.log(`\nIssuer url is ${issuerMetadata.credentialIssuer.credential_issuer}`)

    return issuer
  }

  public async createCredentialOffer(options: {
    credentialConfigurationIds: string[]
    requireAuthorization?: 'presentation' | 'browser'
    requirePin: boolean
  }) {
    const issuerMetadata = await this.agent.modules.openId4VcIssuer.getIssuerMetadata(this.issuerRecord.issuerId)

    const { credentialOffer, issuanceSession } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials: options.credentialConfigurationIds,
      // Pre-auth using our own server
      preAuthorizedCodeFlowConfig: !options.requireAuthorization
        ? {
            authorizationServerUrl: issuerMetadata.credentialIssuer.credential_issuer,
            txCode: options.requirePin
              ? {
                  input_mode: 'numeric',
                  length: 4,
                  description: 'Pin has been printed to the terminal',
                }
              : undefined,
          }
        : undefined,
      // Auth using external authorization server
      authorizationCodeFlowConfig: options.requireAuthorization
        ? {
            authorizationServerUrl: options.requireAuthorization === 'browser' ? PROVIDER_HOST : undefined,
            // TODO: should be generated by us, if we're going to use for matching
            issuerState: utils.uuid(),
            requirePresentationDuringIssuance: options.requireAuthorization === 'presentation',
          }
        : undefined,
    })

    return { credentialOffer, issuanceSession }
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

function assertDidBasedHolderBinding(
  holderBinding: OpenId4VcCredentialHolderBinding
): asserts holderBinding is OpenId4VcCredentialHolderDidBinding {
  if (holderBinding.method !== 'did') {
    throw new CredoError('Only did based holder bindings supported for this credential type')
  }
}
