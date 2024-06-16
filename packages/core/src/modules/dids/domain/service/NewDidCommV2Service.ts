import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { CredoError } from '../../../../error'
import { SingleOrArray, IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils'

import { DidDocumentService } from './DidDocumentService'

export interface NewDidcommV2ServiceEndpointOptions {
  uri: string
  routingKeys?: string[]
  accept?: string[]
}

export class NewDidcommV2ServiceEndpoint {
  public constructor(options: NewDidcommV2ServiceEndpointOptions) {
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

export interface DidcommV2ServiceOptions {
  id: string
  serviceEndpoint: SingleOrArray<NewDidcommV2ServiceEndpoint>
}

/**
 * Will be renamed to `DidcommV2Service` in 0.6 (and replace the current `DidcommV2Service`)
 */
export class NewDidCommV2Service extends DidDocumentService {
  public constructor(options: DidcommV2ServiceOptions) {
    super({ ...options, type: NewDidCommV2Service.type })

    if (options) {
      this.serviceEndpoint = options.serviceEndpoint
    }
  }

  public static type = 'DIDCommMessaging'

  @IsInstanceOrArrayOfInstances({ classType: [NewDidcommV2ServiceEndpoint] })
  @ValidateNested()
  public serviceEndpoint!: SingleOrArray<NewDidcommV2ServiceEndpoint>

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
