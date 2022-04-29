import type { DidDocument, VerificationMethod } from '../../../dids'
import type { DidDocumentService } from '../../../dids/domain/service'
import type { Authentication } from './authentication'

import { Expose } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'

import { AriesFrameworkError } from '../../../../error'
import { TypedArrayEncoder } from '../../../../utils'
import { ServiceTransformer, DidCommService, IndyAgentService } from '../../../dids/domain/service'

import { AuthenticationTransformer, authenticationTypes, ReferencedAuthentication } from './authentication'
import { PublicKey, PublicKeyTransformer } from './publicKey'

type DidDocOptions = Pick<DidDoc, 'id' | 'publicKey' | 'service' | 'authentication'>

export class DidDoc {
  @Expose({ name: '@context' })
  @Equals('https://w3id.org/did/v1')
  public context = 'https://w3id.org/did/v1'

  @IsString()
  public id!: string

  @IsArray()
  @ValidateNested()
  @PublicKeyTransformer()
  public publicKey: PublicKey[] = []

  @IsArray()
  @ValidateNested()
  @ServiceTransformer()
  public service: DidDocumentService[] = []

  @IsArray()
  @ValidateNested()
  @AuthenticationTransformer()
  public authentication: Authentication[] = []

  public constructor(options: DidDocOptions) {
    if (options) {
      this.id = options.id
      this.publicKey = options.publicKey
      this.service = options.service
      this.authentication = options.authentication
    }
  }

  /**
   * Gets the matching public key for a given key id
   *
   * @param id fully qualified key id
   */
  public getPublicKey(id?: string): PublicKey | undefined {
    return this.publicKey.find((item) => (id ? item.id === id : item))
  }

  /**
   * Returns all of the service endpoints matching the given type.
   *
   * @param type The type of service(s) to query.
   */
  public getServicesByType<S extends DidDocumentService = DidDocumentService>(type: string): S[] {
    return this.service.filter((service) => service.type === type) as S[]
  }

  /**
   * Returns all of the service endpoints matching the given class
   *
   * @param classType The class to query services.
   */
  public getServicesByClassType<S extends DidDocumentService = DidDocumentService>(
    classType: new (...args: never[]) => S
  ): S[] {
    return this.service.filter((service) => service instanceof classType) as S[]
  }

  /**
   * Get all DIDComm services ordered by priority descending. This means the highest
   * priority will be the first entry.
   */
  public get didCommServices(): Array<IndyAgentService | DidCommService> {
    const didCommServiceTypes = [IndyAgentService.type, DidCommService.type]
    const services = this.service.filter((service) => didCommServiceTypes.includes(service.type)) as Array<
      IndyAgentService | DidCommService
    >

    // Sort services based on indicated priority
    return services.sort((a, b) => b.priority - a.priority)
  }

  public static convertVerificationMethodToPublicKey(verificationMethod: VerificationMethod): PublicKey {
    const publicKeyBase58 =
      verificationMethod.publicKeyBase58 ?? TypedArrayEncoder.toBase58(verificationMethod.keyBytes)

    return new PublicKey({
      id: verificationMethod.id,
      controller: verificationMethod.controller,
      type: verificationMethod.type,
      value: publicKeyBase58,
    })
  }

  public static convertDIDDocToConnectionDIDDoc(didDocument: DidDocument): DidDoc {
    const authentication = didDocument.authentication?.map((authentication) => {
      if (typeof authentication === 'string') {
        const verificationMethod = didDocument.verificationMethod?.find(
          (verificationMethod) => verificationMethod.id === authentication
        )
        if (!verificationMethod) {
          throw new AriesFrameworkError(`Invalid DIDDoc: Unable to get key definition for kid ${authentication}`)
        }
        return new ReferencedAuthentication(
          this.convertVerificationMethodToPublicKey(verificationMethod),
          authenticationTypes.Ed25519VerificationKey2018
        )
      } else {
        didDocument.verificationMethod.push(authentication)
        return new ReferencedAuthentication(
          this.convertVerificationMethodToPublicKey(authentication),
          authenticationTypes.Ed25519VerificationKey2018
        )
      }
    })

    const publicKeys = didDocument.verificationMethod?.map((verificationMethod) =>
      this.convertVerificationMethodToPublicKey(verificationMethod)
    )

    return new DidDoc({
      id: didDocument.id,
      authentication: authentication || [],
      publicKey: publicKeys || authentication.map((auth) => auth.publicKey),
      service: didDocument.service,
    })
  }
}
