import type { DidKey } from '@credo-ts/core'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VcCredentialHolderDidBinding,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciCredentialSupportedWithId,
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

export const credentialsSupported = [
  universityDegreeCredential,
  openBadgeCredential,
  universityDegreeCredentialSdJwt,
] satisfies OpenId4VciCredentialSupportedWithId[]

// string: string dictionary
const issuanceToUserId = {} as Record<string, string>

function getStringAfterLastSlash(credentialOfferUriEncoded: string): string {
  // Decode the URL-encoded credential_offer_uri
  const credentialOfferUri = decodeURIComponent(credentialOfferUriEncoded)

  // Extract the part after the last '/' in the decoded credential_offer_uri
  const parts = credentialOfferUri.split('/')
  return parts[parts.length - 1]
}

function getNameSurname(userId: string) {
  return {
    name: `Alice${userId}`,
    surname: `Doe${userId}`,
  }
}

function credentialOfferOfferUri(credentialOffer: string) {
  const url = new URL(credentialOffer)
  const credentialOfferUri = url.searchParams.get('credential_offer_uri')
  if (!credentialOfferUri) {
    throw new Error('credential_offer_uri parameter not found in the input string.')
  }
  return credentialOfferUri
}

function getCredentialRequestToCredentialMapper({
  issuerDidKey,
}: {
  issuerDidKey: DidKey
}): OpenId4VciCredentialRequestToCredentialMapper {
  return async ({ issuanceSession, holderBinding, credentialConfigurationIds }) => {
    const issuanceId = getStringAfterLastSlash(issuanceSession.credentialOfferUri)
    const userId = issuanceToUserId[issuanceId]
    const userData = getNameSurname(userId)
    console.log(
      `[issuance ${issuanceId}] We will issue credential with values ${JSON.stringify(userData)} for user ${userId}`
    )

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
    issuer.issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      credentialsSupported,
    })

    return issuer
  }

  public async createCredentialOffer(offeredCredentials: string[]) {
    const userId = Math.random().toString()
    const { credentialOffer } = await this.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: this.issuerRecord.issuerId,
      offeredCredentials,
      preAuthorizedCodeFlowConfig: { userPinRequired: false },
    })

    const credentialOfferUri = credentialOfferOfferUri(credentialOffer)
    const issuanceId = getStringAfterLastSlash(credentialOfferUri)
    issuanceToUserId[issuanceId] = userId
    console.log(`Started issuance ${issuanceId} for user ${userId}`)
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
