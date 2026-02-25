import { IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'

import { DidCommV2Service, DidCommV2ServiceEndpoint } from './DidCommV2Service'
import { DidDocumentService } from './DidDocumentService'

export interface LegacyDidCommV2ServiceOptions {
  id: string
  serviceEndpoint: string
  routingKeys?: string[]
  accept?: string[]
}

export class LegacyDidCommV2Service extends DidDocumentService {
  public constructor(options: LegacyDidCommV2ServiceOptions) {
    super({ ...options, type: LegacyDidCommV2Service.type })

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

  public toNewDidCommV2(): DidCommV2Service {
    return new DidCommV2Service({
      id: this.id,
      serviceEndpoint: new DidCommV2ServiceEndpoint({
        uri: this.serviceEndpoint,
        accept: this.accept,
        routingKeys: this.routingKeys,
      }),
    })
  }
}
