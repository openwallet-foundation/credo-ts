import type { DidCommFeatureOptions } from './DidCommFeature'

import { IsOptional, IsString } from 'class-validator'

import { DidCommFeature } from './DidCommFeature'

export interface ProtocolOptions extends Omit<DidCommFeatureOptions, 'type'> {
  roles?: string[]
}

export class DidCommProtocol extends DidCommFeature {
  public constructor(props: ProtocolOptions) {
    super({ ...props, type: DidCommProtocol.type })

    if (props) {
      this.roles = props.roles
    }
  }

  public static readonly type = 'protocol'

  @IsString({ each: true })
  @IsOptional()
  public roles?: string[]
}
