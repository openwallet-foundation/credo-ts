import type { DidKey } from '@credo-ts/core'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VcCredentialHolderDidBinding,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciSignMdocCredential,
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
} from '@credo-ts/core'
import { OpenId4VcIssuerModule, OpenId4VciCredentialFormatProfile } from '@credo-ts/openid4vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

// TODO: this should error
const credentialConfigurationsSupported = {
  UniversityDegreeCredential: {
    format: OpenId4VciCredentialFormatProfile.JwtVcJson,
    types: ['VerifiableCredential', 'UniversityDegreeCredential'],
    scope: 'openid4vc:credential:UniversityDegreeCredential',
  },
  OpenBadgeCredential: {
    format: OpenId4VciCredentialFormatProfile.JwtVcJson,
    types: ['VerifiableCredential', 'OpenBadgeCredential'],
    scope: 'openid4vc:credential:OpenBadgeCredential',
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
    holderBinding,
    credentialConfigurationIds,
    credentialConfigurationsSupported: supported,
    agentContext,
  }) => {
    const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    if (trustedCertificates?.length !== 1) {
      throw new Error(`Expected exactly one trusted certificate. Received ${trustedCertificates?.length}.`)
    }

    // FIXME: correct type inference
    const credentialConfigurationId = credentialConfigurationIds[0]
    const credentialConfiguration = supported[credentialConfigurationId]

    if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
      assertDidBasedHolderBinding(holderBinding)
      const configuration = credentialConfigurationsSupported.UniversityDegreeCredential

      return {
        credentialSupportedId: credentialConfigurationId,
        format: ClaimFormat.JwtVc,
        credential: new W3cCredential({
          type: configuration.types,
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
    }

    if (credentialConfiguration.scope === credentialConfigurationsSupported.OpenBadgeCredential.scope) {
      assertDidBasedHolderBinding(holderBinding)
      const configuration = credentialConfigurationsSupported.OpenBadgeCredential

      return {
        format: ClaimFormat.JwtVc,
        credentialSupportedId: credentialConfigurationId,
        credential: new W3cCredential({
          type: configuration.types,
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
    }

    if (credentialConfiguration.scope === credentialConfigurationsSupported['UniversityDegreeCredential-sdjwt'].scope) {
      const configuration = credentialConfigurationsSupported['UniversityDegreeCredential-sdjwt']

      return {
        credentialSupportedId: credentialConfigurationId,
        format: ClaimFormat.SdJwtVc,
        payload: { vct: configuration.vct, university: 'innsbruck', degree: 'bachelor' },
        holder: holderBinding,
        issuer: {
          method: 'did',
          didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
        },
        disclosureFrame: { _sd: ['university', 'degree'] },
      }
    }

    if (credentialConfiguration.scope === credentialConfigurationsSupported['UniversityDegreeCredential-mdoc'].scope) {
      const configuration = credentialConfigurationsSupported['UniversityDegreeCredential-mdoc']
      return {
        credentialSupportedId: credentialConfigurationId,
        format: ClaimFormat.MsoMdoc,
        docType: configuration.doctype,
        issuerCertificate: trustedCertificates[0],
        holderKey: holderBinding.key,
        namespaces: {
          'Leopold-Franzens-University': {
            degree: 'bachelor',
          },
        },
      } satisfies OpenId4VciSignMdocCredential
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

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(issuer.agent.context, {
      key: await issuer.agent.context.wallet.createKey({ keyType: KeyType.P256 }),
      notBefore: currentDate,
      notAfter: nextDay,
      extensions: [],
      name: 'C=DE',
    })

    const issuerCertficicate = selfSignedCertificate.toString('pem')
    await issuer.agent.x509.setTrustedCertificates([issuerCertficicate])
    console.log('Set the following certficate for the holder to verify mdoc credentials.')
    console.log(issuerCertficicate)

    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '726222ad-7624-4f12-b15b-e08aa7042ffa',
      credentialConfigurationsSupported,
      // FIXME: should be extraAuthorizationServerConfigs.
      authorizationServerConfigs: [
        {
          issuer: 'http://localhost:3042',
          serverType: 'oidc',
          clientId: 'issuer-server',
          clientSecret: 'issuer-server',
        },
      ],
    })

    return issuer
  }

  public async createCredentialOffer(offeredCredentials: string[]) {
    // const issuerMetadata = await this.agent.modules.openId4VcIssuer.getIssuerMetadata(this.issuerRecord.issuerId)

    const { credentialOffer, issuanceSession } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials,
      // FIXME: wait for PR in OID4VCI repo
      // // Pre-auth using our own server
      // preAuthorizedCodeFlowConfig: {
      //   authorizationServerUrl: issuerMetadata.issuerUrl,
      // },
      // Auth using external authorization server
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:3042',
        issuerState: 'f498b73c-144f-4eea-bd6b-7be89b35936e',
      },
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
