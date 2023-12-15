import type {
  CredentialRequestToCredentialMapper,
  CredentialSupported,
  OfferedCredential,
  IssuerEndpointConfig,
} from '@aries-framework/openid4vc'
import type e from 'express'

import { AskarModule } from '@aries-framework/askar'
import { W3cCredential, W3cCredentialSubject, W3cIssuer, w3cDate } from '@aries-framework/core'
import { OpenId4VcIssuerModule, OpenIdCredentialFormatProfile } from '@aries-framework/openid4vc'
import { SdJwtCredential, SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export const universityDegreeCredential = {
  id: 'UniversityDegreeCredential',
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
} satisfies CredentialSupported & { id: string }

export const openBadgeCredential = {
  id: 'OpenBadgeCredential',
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
} satisfies CredentialSupported & { id: string }

export const universityDegreeCredentialSdJwt = {
  id: 'UniversityDegreeCredential-sdjwt',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    vct: 'UniversityDegreeCredential',
  },
} satisfies CredentialSupported & { id: string }

export const credentialsSupported = [
  universityDegreeCredential,
  openBadgeCredential,
  universityDegreeCredentialSdJwt,
] satisfies CredentialSupported[]

function getOpenIdIssuerModules() {
  return {
    sdJwtVc: new SdJwtVcModule(),
    askar: new AskarModule({ ariesAskar }),
    openId4VcIssuer: new OpenId4VcIssuerModule({
      issuerMetadata: {
        issuerBaseUrl: 'http://localhost:2000',
        tokenEndpointPath: '/token',
        credentialEndpointPath: '/credentials',
        credentialsSupported,
      },
    }),
  } as const
}

export class Issuer extends BaseAgent<ReturnType<typeof getOpenIdIssuerModules>> {
  public constructor(port: number, name: string) {
    super({ port, name, modules: getOpenIdIssuerModules() })
  }

  public static async build(): Promise<Issuer> {
    const issuer = new Issuer(2000, 'OpenId4VcIssuer ' + Math.random().toString())
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598f')

    return issuer
  }

  public async configureRouter(): Promise<e.Router> {
    const endpointConfig: IssuerEndpointConfig = {
      basePath: '/',
      metadataEndpointConfig: { enabled: true },
      accessTokenEndpointConfig: {
        enabled: true,
        verificationMethod: this.verificationMethod,
        preAuthorizedCodeExpirationDuration: 100,
      },
      credentialEndpointConfig: {
        enabled: true,
        verificationMethod: this.verificationMethod,
        credentialRequestToCredentialMapper: await this.getCredentialRequestToCredentialMapper(),
      },
    }

    const router = await this.agent.modules.openId4VcIssuer.configureRouter(Router(), endpointConfig)
    this.app.use('/', router)
    return router
  }

  public getCredentialRequestToCredentialMapper(): CredentialRequestToCredentialMapper {
    return async ({ credentialRequest, holderDid, holderDidUrl }) => {
      if (
        credentialRequest.format === 'jwt_vc_json' &&
        credentialRequest.types.includes('UniversityDegreeCredential')
      ) {
        return new W3cCredential({
          type: universityDegreeCredential.types,
          issuer: new W3cIssuer({ id: this.did }),
          credentialSubject: new W3cCredentialSubject({ id: holderDid }),
          issuanceDate: w3cDate(Date.now()),
        })
      }

      if (credentialRequest.format === 'jwt_vc_json' && credentialRequest.types.includes('OpenBadgeCredential')) {
        return new W3cCredential({
          type: openBadgeCredential.types,
          issuer: new W3cIssuer({ id: this.did }),
          credentialSubject: new W3cCredentialSubject({ id: holderDid }),
          issuanceDate: w3cDate(Date.now()),
        })
      }

      if (
        credentialRequest.format === 'vc+sd-jwt' &&
        credentialRequest.credential_definition.vct === 'UniversityDegreeCredential'
      ) {
        return new SdJwtCredential({
          payload: { type: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
          holderDidUrl,
          issuerDidUrl: this.kid,
          disclosureFrame: { university: true, degree: true },
        })
      }

      throw new Error('Invalid request')
    }
  }

  public async createCredentialOffer(offeredCredentials: OfferedCredential[]) {
    const { credentialOfferRequest } = await this.agent.modules.openId4VcIssuer.createCredentialOfferAndRequest(
      offeredCredentials,
      {
        scheme: 'openid-credential-offer',
        preAuthorizedCodeFlowConfig: { userPinRequired: false },
      }
    )

    return credentialOfferRequest
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
