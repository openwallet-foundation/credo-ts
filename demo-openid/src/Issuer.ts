import type {
  CredentialRequestToCredentialMapper,
  CredentialSupported,
  EndpointConfig,
  OfferedCredential,
} from '@aries-framework/openid4vc-issuer'
import type e from 'express'

import { AskarModule } from '@aries-framework/askar'
import { W3cCredential, W3cCredentialSubject, W3cIssuer, w3cDate } from '@aries-framework/core'
import { OpenId4VcIssuerModule } from '@aries-framework/openid4vc-issuer'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export const universityDegreeCredential: CredentialSupported & { id: string } = {
  id: 'UniversityDegreeCredential',
  format: 'jwt_vc_json',
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

export const openBadgeCredential: CredentialSupported & { id: string } = {
  id: 'OpenBadgeCredential',
  format: 'jwt_vc_json',
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

export const credentialsSupported = [universityDegreeCredential, openBadgeCredential]

function getOpenIdIssuerModules() {
  return {
    askar: new AskarModule({ ariesAskar }),
    openId4VcIssuer: new OpenId4VcIssuerModule({
      issuerMetadata: {
        credentialIssuer: 'http://localhost:2000',
        tokenEndpoint: 'http://localhost:2000/token',
        credentialEndpoint: 'http://localhost:2000/credentials',
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
    await issuer.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598g')

    return issuer
  }

  public async configureRouter(): Promise<e.Router> {
    const endpointConfig: EndpointConfig = {
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
    return async (credentialRequest, holderDid) => {
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
