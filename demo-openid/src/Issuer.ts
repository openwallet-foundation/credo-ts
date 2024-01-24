import type { DidKey } from '@aries-framework/core'
import type {
  CredentialHolderBinding,
  CredentialHolderDidBinding,
  CredentialRequestToCredentialMapper,
  OpenId4VciCredentialSupportedWithId,
  OpenId4VcIssuerRecord,
} from '@aries-framework/openid4vc'

import { AskarModule } from '@aries-framework/askar'
import {
  parseDid,
  AriesFrameworkError,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
} from '@aries-framework/core'
import { OpenId4VcIssuerModule, OpenId4VciCredentialFormatProfile } from '@aries-framework/openid4vc'
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

export const credentialsSupported = [
  universityDegreeCredential,
  openBadgeCredential,
  universityDegreeCredentialSdJwt,
] satisfies OpenId4VciCredentialSupportedWithId[]

function getCredentialRequestToCredentialMapper({
  issuerDidKey,
}: {
  issuerDidKey: DidKey
}): CredentialRequestToCredentialMapper {
  return async ({ holderBinding, credentialsSupported }) => {
    const credentialSupported = credentialsSupported[0]

    if (credentialSupported.id === universityDegreeCredential.id) {
      assertDidBasedHolderBinding(holderBinding)

      return {
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

    if (credentialSupported.id === openBadgeCredential.id) {
      assertDidBasedHolderBinding(holderBinding)

      return {
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

    if (credentialSupported.id === universityDegreeCredentialSdJwt.id) {
      return {
        payload: { vct: universityDegreeCredentialSdJwt.vct, university: 'innsbruck', degree: 'bachelor' },
        holder: holderBinding,
        issuer: {
          method: 'did',
          didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
        },
        disclosureFrame: { university: true, degree: true },
      }
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
      } as const,
    })

    this.app.use('/oid4vci', openId4VciRouter)
  }

  public static async build(): Promise<Issuer> {
    const issuer = new Issuer(2000, 'OpenId4VcIssuer ' + Math.random().toString())
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598f')
    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      credentialsSupported,
    })

    return issuer
  }

  public async createCredentialOffer(offeredCredentials: string[]) {
    const { credentialOfferUri } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials,
      scheme: 'openid-credential-offer',
      preAuthorizedCodeFlowConfig: { userPinRequired: false },
    })

    return credentialOfferUri
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
  holderBinding: CredentialHolderBinding
): asserts holderBinding is CredentialHolderDidBinding {
  throw new AriesFrameworkError('Only did based holder bindings supported for this credential type')
}
