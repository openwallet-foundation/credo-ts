import { Expose } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'

import { AuthenticationTransformer, Authentication } from './authentication'
import { PublicKey, PublicKeyTransformer } from './publicKey'
import { Service, ServiceTransformer } from './service'

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
  public service: Service[] = []

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
  public getPublicKey(id: string): PublicKey | undefined {
    return this.publicKey.find((item) => item.id === id)
  }

  /**
   * Returns all of the service endpoints matching the given type.
   *
   * @param type The type of service(s) to query.
   */
  public getServicesByType<S extends Service = Service>(type: string): S[] {
    return this.service.filter((service) => service.type === type) as S[]
  }

  /**
   * Returns all of the service endpoints matching the given class
   *
   * @param classType The class to query services.
   */
  public getServicesByClassType<S extends Service = Service>(classType: new (...args: never[]) => S): S[] {
    return this.service.filter((service) => service instanceof classType) as S[]
  }
}
