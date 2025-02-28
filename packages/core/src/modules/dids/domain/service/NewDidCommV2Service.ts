import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { CredoError } from '../../../../error'
import { IsInstanceOrArrayOfInstances, IsUri, SingleOrArray } from '../../../../utils'

import { DidDocumentService } from './DidDocumentService'

export interface NewDidCommV2ServiceEndpointOptions {
  uri: string
  routingKeys?: string[]
  accept?: string[]
}

export class NewDidCommV2ServiceEndpoint {
  public constructor(options: NewDidCommV2ServiceEndpointOptions) {
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
  serviceEndpoint: SingleOrArray<NewDidCommV2ServiceEndpoint>
}

/**
 * Will be renamed to `DidCommV2Service` in 0.6 (and replace the current `DidCommV2Service`)
 */
export class NewDidCommV2Service extends DidDocumentService {
  public constructor(options: DidCommV2ServiceOptions) {
    super({ ...options, type: NewDidCommV2Service.type })

    if (options) {
      this.serviceEndpoint = options.serviceEndpoint
    }
  }

  public static type = 'DIDCommMessaging'

  @IsInstanceOrArrayOfInstances({ classType: [NewDidCommV2ServiceEndpoint] })
  @ValidateNested()
  @Type(() => NewDidCommV2ServiceEndpoint)
  public serviceEndpoint!: SingleOrArray<NewDidCommV2ServiceEndpoint>

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
