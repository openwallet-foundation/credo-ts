import { IsOptional, IsString } from 'class-validator'

import { DidDocumentService } from './DidDocumentService'

export class DidCommV2Service extends DidDocumentService {
  public constructor(options: { id: string; serviceEndpoint: string; routingKeys?: string[]; accept?: string[] }) {
    super({ ...options, type: DidCommV2Service.type })

    if (options) {
      this.routingKeys = options.routingKeys
      this.accept = options.accept
    }
  }

  public static type = 'DIDComm'

  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]
}
