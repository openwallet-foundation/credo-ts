import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { CredoError } from '../../../../error'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils'

import { SingleOrArray } from '../../../../types'
import { DidDocumentService } from './DidDocumentService'

export interface DidCommV2ServiceEndpointOptions {
  uri: string
  routingKeys?: string[]
  accept?: string[]
}

export class DidCommV2ServiceEndpoint {
  public constructor(options: DidCommV2ServiceEndpointOptions) {
    if (options) {
      this.uri = options.uri
      this.routingKeys = options.routingKeys
      this.accept = options.accept
    }
  }

  @IsString()
  @IsUri()
  public uri!: string

  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[];

  [key: string]: unknown | undefined
}

export interface DidCommV2ServiceOptions {
  id: string
  serviceEndpoint: SingleOrArray<DidCommV2ServiceEndpoint>
}

export class DidCommV2Service extends DidDocumentService {
  public constructor(options: DidCommV2ServiceOptions) {
    super({ ...options, type: DidCommV2Service.type })

    if (options) {
      this.serviceEndpoint = options.serviceEndpoint
    }
  }

  public static type = 'DIDCommMessaging'

  @IsInstanceOrArrayOfInstances({ classType: [DidCommV2ServiceEndpoint] })
  @ValidateNested()
  @Type(() => DidCommV2ServiceEndpoint)
  public serviceEndpoint!: SingleOrArray<DidCommV2ServiceEndpoint>

  public get firstServiceEndpointUri(): string {
    if (Array.isArray(this.serviceEndpoint)) {
      if (this.serviceEndpoint.length === 0) {
        throw new CredoError('No entries in serviceEndpoint array')
      }

      return this.serviceEndpoint[0].uri
    }

    return this.serviceEndpoint.uri
  }
}
