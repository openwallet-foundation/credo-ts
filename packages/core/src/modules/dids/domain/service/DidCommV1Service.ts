import { ArrayNotEmpty, IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'
import { getProtocolScheme } from '../../../../utils/uri'

import { DidDocumentService } from './DidDocumentService'

export class DidCommV1Service extends DidDocumentService {
  public constructor(options: {
    id: string
    serviceEndpoint: string
    recipientKeys: string[]
    routingKeys?: string[]
    accept?: string[]
    priority?: number
  }) {
    super({ ...options, type: DidCommV1Service.type })

    if (options) {
      this.recipientKeys = options.recipientKeys
      this.routingKeys = options.routingKeys
      this.accept = options.accept
      if (options.priority) this.priority = options.priority
    }
  }

  public static type = 'did-communication'

  public get protocolScheme(): string {
    return getProtocolScheme(this.serviceEndpoint)
  }

  @IsString()
  @IsUri()
  public serviceEndpoint!: string

  @ArrayNotEmpty()
  @IsString({ each: true })
  public recipientKeys!: string[]

  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]

  public priority = 0
}
