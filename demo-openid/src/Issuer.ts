import type { DidKey } from '@credo-ts/core'
import type {
  OpenId4VcIssuerRecord,
  OpenId4VcVerifierRecord,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciSignMdocCredentials,
  OpenId4VciSignSdJwtCredentials,
  OpenId4VciSignW3cCredentials,
  VerifiedOpenId4VcCredentialHolderBinding,
} from '@credo-ts/openid4vc'

import { AskarModule } from '@credo-ts/askar'
import {
  ClaimFormat,
  CredoError,
  JsonTransformer,
  KeyType,
  TypedArrayEncoder,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  X509ModuleConfig,
  X509Service,
  parseDid,
  utils,
  w3cDate,
} from '@credo-ts/core'
import {
  OpenId4VcIssuerModule,
  OpenId4VcVerifierApi,
  OpenId4VcVerifierModule,
  OpenId4VciCredentialFormatProfile,
} from '@credo-ts/openid4vc'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

const _PROVIDER_HOST = process.env.PROVIDER_HOST ?? 'http://localhost:3042'
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
  return async ({ holderBinding, credentialConfigurationId, credentialConfiguration, agentContext, authorization }) => {
    const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    if (trustedCertificates?.length !== 1) {
      throw new Error(`Expected exactly one trusted certificate. Received ${trustedCertificates?.length}.`)
    }

    if (credentialConfigurationId === 'PresentationAuthorization') {
      return {
        format: ClaimFormat.SdJwtVc,
        credentials: holderBinding.keys.map((binding) => ({
          payload: {
            vct: credentialConfiguration.vct,
            authorized_user: authorization.accessToken.payload.sub,
          },
          holder: binding,
          issuer:
            binding.method === 'did'
              ? {
                  method: 'did',
                  didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
                }
              : { method: 'x5c', x5c: [trustedCertificates[0]], issuer: ISSUER_HOST },
        })),
      } satisfies OpenId4VciSignSdJwtCredentials
    }

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
      assertDidBasedHolderBinding(holderBinding)

      return {
        format: ClaimFormat.JwtVc,
        credentials: holderBinding.keys.map((binding) => {
          return {
            credential: new W3cCredential({
              type: credentialConfiguration.credential_definition.type,
              issuer: new W3cIssuer({
                id: issuerDidKey.did,
              }),
              credentialSubject: JsonTransformer.fromJSON(
                {
                  id: parseDid(binding.didUrl).did,
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
        format: ClaimFormat.SdJwtVc,
        credentials: holderBinding.keys.map((binding) => ({
          payload: {
            vct: credentialConfiguration.vct,
            university: 'innsbruck',
            degree: 'bachelor',
            authorized_user: authorization.accessToken.payload.sub,
          },
          holder: binding,
          issuer: {
            method: 'did',
            didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
          },
          disclosureFrame: { _sd: ['university', 'degree', 'authorized_user'] },
        })),
      } satisfies OpenId4VciSignSdJwtCredentials
    }

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
      assertJwkBasedHolderBinding(holderBinding)

      return {
        format: ClaimFormat.MsoMdoc,
        credentials: holderBinding.keys.map((binding) => ({
          issuerCertificate: trustedCertificates[0],
          holderKey: binding.key,
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
        askar: new AskarModule({ askar }),
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
    const issuer = new Issuer(ISSUER_HOST, 2000, `OpenId4VcIssuer ${Math.random().toString()}`)
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598f')

    const certificate = await X509Service.createCertificate(issuer.agent.context, {
      authorityKey: await issuer.agent.context.wallet.createKey({
        keyType: KeyType.P256,
        seed: TypedArrayEncoder.fromString('e5f18b10cd15cdb76818bc6ae8b71eb475e6eac76875ed085d3962239bbcf42f'),
      }),
      validity: {
        notBefore: new Date('2000-01-01'),
        notAfter: new Date('2050-01-01'),
      },
      extensions: {
        subjectAlternativeName: {
          name: [{ type: 'dns', value: ISSUER_HOST.replace('https://', '').replace('http://', '') }],
        },
      },
      issuer: 'C=DE',
    })

    const issuerCertficicate = certificate.toString('base64url')
    await issuer.agent.x509.setTrustedCertificates([issuerCertficicate])
    console.log('Set the following certficate for the holder to verify mdoc credentials.')
    console.log(issuerCertficicate)

    issuer.verifierRecord = await issuer.agent.modules.openId4VcVerifier.createVerifier({
      verifierId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
    })
    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
      credentialConfigurationsSupported,
      // authorizationServerConfigs: [
      //   {
      //     issuer: PROVIDER_HOST,
      //     clientAuthentication: {
      //       clientId: 'issuer-server',
      //       clientSecret: 'issuer-server',
      //     },
      //   },
      // ],
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
      credentialConfigurationIds: options.credentialConfigurationIds,
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
            authorizationServerUrl:
              options.requireAuthorization === 'browser'
                ? issuerMetadata.credentialIssuer.credential_issuer
                : undefined,
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
    await this.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.shutdown()
  }
}

function assertDidBasedHolderBinding(
  holderBinding: VerifiedOpenId4VcCredentialHolderBinding
): asserts holderBinding is VerifiedOpenId4VcCredentialHolderBinding & { bindingMethod: 'did' } {
  if (holderBinding.bindingMethod !== 'did') {
    throw new CredoError('Only did based holder bindings supported for this credential type')
  }
}

function assertJwkBasedHolderBinding(
  holderBinding: VerifiedOpenId4VcCredentialHolderBinding
): asserts holderBinding is VerifiedOpenId4VcCredentialHolderBinding & { bindingMethod: 'jwk' } {
  if (holderBinding.bindingMethod !== 'jwk') {
    throw new CredoError('Only jwk based holder bindings supported for this credential type')
  }
}
