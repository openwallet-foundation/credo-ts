import type { VerificationMethod } from '../../../modules/dids'
import type { DIDDoc, DIDResolver } from 'didcomm-node'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { DidResolverService } from '../../../modules/dids'

@scoped(Lifecycle.ContainerScoped)
export class DIDResolverService implements DIDResolver {
  private resolverService: DidResolverService

  public constructor(resolverService: DidResolverService) {
    this.resolverService = resolverService
  }

  public async resolve(did: string): Promise<DIDDoc | null> {
    const result = await this.resolverService.resolve(did)
    if (!result.didDocument || !result.didDocument.verificationMethod.length) {
      throw new AriesFrameworkError(`Unable to resolve DIDDoc for ${did}`)
    }

    const verificationMethods = result.didDocument.verificationMethod.map((verificationMethod) =>
      DIDResolverService.mapVerificationMethod(verificationMethod)
    )

    const services = result.didDocument.service.map((service) => ({
      id: service.id,
      kind: {
        DIDCommMessaging: {
          service_endpoint: service.serviceEndpoint,
          accept: [],
          route_keys: [],
        },
      },
    }))

    const didDod: DIDDoc = {
      did: result.didDocument.id,
      verification_methods: verificationMethods,
      services: services,
      key_agreements: [],
      authentications: [],
    }

    for (const keyAgreement of result.didDocument.keyAgreement) {
      if (typeof keyAgreement === 'string') {
        didDod.key_agreements.push(keyAgreement)
      } else {
        didDod.key_agreements.push(keyAgreement.id)
        didDod.verification_methods.push(DIDResolverService.mapVerificationMethod(keyAgreement))
      }
    }

    for (const authentication of result.didDocument.authentication) {
      if (typeof authentication === 'string') {
        didDod.authentications.push(authentication)
      } else {
        didDod.authentications.push(authentication.id)
        didDod.verification_methods.push(DIDResolverService.mapVerificationMethod(authentication))
      }
    }

    return didDod
  }

  private static mapVerificationMethod(verificationMethod: VerificationMethod) {
    return {
      id: verificationMethod.id,
      type: verificationMethod.type,
      controller: verificationMethod.controller,
      verification_material: verificationMethod.publicKeyBase58
        ? { Base58: verificationMethod.publicKeyBase58 }
        : verificationMethod.publicKeyMultibase
        ? { Multibase: verificationMethod.publicKeyMultibase }
        : verificationMethod.publicKeyHex
        ? { Hex: verificationMethod.publicKeyHex }
        : verificationMethod.publicKeyJwk
        ? { JWK: verificationMethod.publicKeyJwk }
        : {
            Other:
              verificationMethod.publicKeyPem ||
              verificationMethod.publicKeyBase64 ||
              verificationMethod.blockchainAccountId ||
              verificationMethod.ethereumAddress,
          },
    }
  }
}
