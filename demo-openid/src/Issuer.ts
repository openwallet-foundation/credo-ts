import type { DidKey } from '@credo-ts/core'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VcCredentialHolderDidBinding,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciCredentialSupportedWithId,
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

export const universityDegreeCredential = {
  id: 'UniversityDegreeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
} satisfies OpenId4VciCredentialSupportedWithId

export const openBadgeCredential = {
  id: 'OpenBadgeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
} satisfies OpenId4VciCredentialSupportedWithId

export const universityDegreeCredentialSdJwt = {
  id: 'UniversityDegreeCredential-sdjwt',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential',
} satisfies OpenId4VciCredentialSupportedWithId

export const universityDegreeCredentialMdoc = {
  id: 'UniversityDegreeCredential-mdoc',
  format: OpenId4VciCredentialFormatProfile.MsoMdoc,
  doctype: 'UniversityDegreeCredential',
} satisfies OpenId4VciCredentialSupportedWithId

export const credentialsSupported = [
  universityDegreeCredential,
  openBadgeCredential,
  universityDegreeCredentialSdJwt,
  universityDegreeCredentialMdoc,
] satisfies OpenId4VciCredentialSupportedWithId[]

function getCredentialRequestToCredentialMapper({
  issuerDidKey,
}: {
  issuerDidKey: DidKey
}): OpenId4VciCredentialRequestToCredentialMapper {
  return async ({ holderBinding, credentialConfigurationIds, agentContext }) => {
    const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    if (trustedCertificates?.length !== 1) {
      throw new Error(`Expected exactly one trusted certificate. Received ${trustedCertificates?.length}.`)
    }
    const credentialConfigurationId = credentialConfigurationIds[0]

    if (credentialConfigurationId === universityDegreeCredential.id) {
      assertDidBasedHolderBinding(holderBinding)

      return {
        credentialSupportedId: universityDegreeCredential.id,
        format: ClaimFormat.JwtVc,
        credential: new W3cCredential({
          type: universityDegreeCredential.types,
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

    if (credentialConfigurationId === openBadgeCredential.id) {
      assertDidBasedHolderBinding(holderBinding)

      return {
        format: ClaimFormat.JwtVc,
        credentialSupportedId: openBadgeCredential.id,
        credential: new W3cCredential({
          type: openBadgeCredential.types,
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

    if (credentialConfigurationId === universityDegreeCredentialSdJwt.id) {
      return {
        credentialSupportedId: universityDegreeCredentialSdJwt.id,
        format: ClaimFormat.SdJwtVc,
        payload: { vct: universityDegreeCredentialSdJwt.vct, university: 'innsbruck', degree: 'bachelor' },
        holder: holderBinding,
        issuer: {
          method: 'did',
          didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
        },
        disclosureFrame: { _sd: ['university', 'degree'] },
      }
    }

    if (credentialConfigurationId === universityDegreeCredentialMdoc.id) {
      return {
        credentialSupportedId: universityDegreeCredentialMdoc.id,
        format: ClaimFormat.MsoMdoc,
        docType: universityDegreeCredentialMdoc.doctype,
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
      credentialsSupported,
    })

    return issuer
  }

  public async createCredentialOffer(offeredCredentials: string[]) {
    const { credentialOffer } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials,
      preAuthorizedCodeFlowConfig: { userPinRequired: false },
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
