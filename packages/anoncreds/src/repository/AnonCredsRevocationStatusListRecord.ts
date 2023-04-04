import type { AnonCredsRevocationStatusList } from '../models'
import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsRevocationStatusListRecordProps {
  id?: string
  credentialDefinitionId: string
  revocationStatusList: AnonCredsRevocationStatusList
}

export type DefaultAnonCredsRevocationStatusListTags = {
  revocationRegistryDefinitionId: string
  credentialDefinitionId: string
  timestamp: string
}

export class AnonCredsRevocationStatusListRecord extends BaseRecord<
  DefaultAnonCredsRevocationStatusListTags,
  TagsBase
> {
  public static readonly type = 'AnonCredsRevocationStatusListRecord'
  public readonly type = AnonCredsRevocationStatusListRecord.type

  public readonly credentialDefinitionId!: string
  public readonly revocationStatusList!: AnonCredsRevocationStatusList

  public constructor(props: AnonCredsRevocationStatusListRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialDefinitionId = props.credentialDefinitionId
      this.revocationStatusList = props.revocationStatusList
    }
  }

  public getTags() {
    return {
      ...this._tags,
      revocationRegistryDefinitionId: this.revocationStatusList.revRegDefId,
      credentialDefinitionId: this.credentialDefinitionId,
      timestamp: this.revocationStatusList.timestamp.toString(),
    }
  }
}
