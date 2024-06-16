import { IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'

import { DidDocumentService } from './DidDocumentService'
import { NewDidCommV2Service, NewDidCommV2ServiceEndpoint } from './NewDidCommV2Service'

export interface DidCommV2ServiceOptions {
  id: string
  serviceEndpoint: string
  routingKeys?: string[]
  accept?: string[]
}

/**
 * @deprecated use `NewDidCommV2Service` instead. Will be renamed to `LegacyDidCommV2Service` in 0.6
 */
export class DidCommV2Service extends DidDocumentService {
  public constructor(options: DidCommV2ServiceOptions) {
    super({ ...options, type: DidCommV2Service.type })

    if (options) {
      this.serviceEndpoint = options.serviceEndpoint
      this.accept = options.accept
      this.routingKeys = options.routingKeys
    }
  }

  public static type = 'DIDComm'

  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]

  @IsUri()
  @IsString()
  public serviceEndpoint!: string

  public toNewDidCommV2(): NewDidCommV2Service {
    return new NewDidCommV2Service({
      id: this.id,
      serviceEndpoint: new NewDidCommV2ServiceEndpoint({
        uri: this.serviceEndpoint,
        accept: this.accept,
        routingKeys: this.routingKeys,
      }),
    })
  }
}
