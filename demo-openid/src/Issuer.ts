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
} from '@credo-ts/core'
import { OpenId4VcIssuerModule, OpenId4VciCredentialFormatProfile } from '@credo-ts/openid4vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export const credentialConfigurationsSupported = {
  'UniversityDegreeCredential-jwtvcjson': {
    format: OpenId4VciCredentialFormatProfile.JwtVcJson,
    scope: 'openid4vc:credential:UniversityDegreeCredential-jwtvcjson',
    credential_definition: {
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    },
  },
  'UniversityDegreeCredential-sdjwt': {
    format: OpenId4VciCredentialFormatProfile.SdJwtVc,
    vct: 'UniversityDegreeCredential',
    scope: 'openid4vc:credential:OpenBadgeCredential-sdjwt',
  },
  'UniversityDegreeCredential-mdoc': {
    format: OpenId4VciCredentialFormatProfile.MsoMdoc,
    doctype: 'UniversityDegreeCredential',
    scope: 'openid4vc:credential:OpenBadgeCredential-mdoc',
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
  }) => {
    const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    if (trustedCertificates?.length !== 1) {
      throw new Error(`Expected exactly one trusted certificate. Received ${trustedCertificates?.length}.`)
    }

    const credentialConfigurationId = credentialConfigurationIds[0]
    const credentialConfiguration = supported[credentialConfigurationId]

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
              credentialSubject: new W3cCredentialSubject({
                id: parseDid(holderBinding.didUrl).did,
              }),
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
          payload: { vct: credentialConfiguration.vct, university: 'innsbruck', degree: 'bachelor' },
          holder: holderBinding,
          issuer: {
            method: 'did',
            didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
          },
          disclosureFrame: { _sd: ['university', 'degree'] },
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
}> {
  public issuerRecord!: OpenId4VcIssuerRecord

  public constructor(port: number, name: string) {
    const openId4VciRouter = Router()

    super({
      port,
      name,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: 'http://localhost:2000/oid4vci',
          router: openId4VciRouter,
          endpoints: {
            credential: {
              credentialRequestToCredentialMapper: (...args) =>
                getCredentialRequestToCredentialMapper({ issuerDidKey: this.didKey })(...args),
            },
          },
        }),
      },
    })

    this.app.use('/oid4vci', openId4VciRouter)
  }

  public static async build(): Promise<Issuer> {
    const issuer = new Issuer(2000, 'OpenId4VcIssuer ' + Math.random().toString())
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598f')

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(issuer.agent.context, {
      key: await issuer.agent.context.wallet.createKey({
        keyType: KeyType.P256,
        seed: TypedArrayEncoder.fromString('e5f18b10cd15cdb76818bc6ae8b71eb475e6eac76875ed085d3962239bbcf42f'),
      }),
      notBefore: new Date('2000-01-01'),
      notAfter: new Date('2050-01-01'),
      extensions: [],
      name: 'C=DE',
    })

    const issuerCertficicate = selfSignedCertificate.toString('base64url')
    await issuer.agent.x509.setTrustedCertificates([issuerCertficicate])
    console.log('Set the following certficate for the holder to verify mdoc credentials.')
    console.log(issuerCertficicate)

    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
      credentialConfigurationsSupported,
      authorizationServerConfigs: [
        {
          issuer: 'http://localhost:3042',
          clientAuthentication: {
            clientId: 'issuer-server',
            clientSecret: 'issuer-server',
          },
        },
      ],
    })

    return issuer
  }

  public async createCredentialOffer(options: { credentialConfigurationIds: string[]; requireAuthorization: boolean }) {
    const issuerMetadata = await this.agent.modules.openId4VcIssuer.getIssuerMetadata(this.issuerRecord.issuerId)

    const { credentialOffer } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials: options.credentialConfigurationIds,
      // Pre-auth using our own server
      preAuthorizedCodeFlowConfig: !options.requireAuthorization
        ? {
            authorizationServerUrl: issuerMetadata.credentialIssuer.credential_issuer,
          }
        : undefined,
      // Auth using external authorization server
      authorizationCodeFlowConfig: options.requireAuthorization
        ? {
            authorizationServerUrl: 'http://localhost:3042',
            // TODO: should be generated by us, if we're going to use for matching
            issuerState: utils.uuid(),
          }
        : undefined,
    })

    return credentialOffer
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
