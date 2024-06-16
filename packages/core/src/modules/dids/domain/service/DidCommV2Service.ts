import { IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'

import { DidDocumentService } from './DidDocumentService'
import { NewDidCommV2Service, NewDidcommV2ServiceEndpoint } from './NewDidCommV2Service'

export interface DidcommV2ServiceOptions {
  id: string
  serviceEndpoint: string
  routingKeys?: string[]
  accept?: string[]
}

/**
 * @deprecated use `NewDidcommV2Service` instead. Will be renamed to `LegacyDidcommV2Service` in 0.6
 */
export class DidCommV2Service extends DidDocumentService {
  public constructor(options: DidcommV2ServiceOptions) {
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
      serviceEndpoint: new NewDidcommV2ServiceEndpoint({
        uri: this.serviceEndpoint,
        accept: this.accept,
        routingKeys: this.routingKeys,
      }),
    })
  }
}
