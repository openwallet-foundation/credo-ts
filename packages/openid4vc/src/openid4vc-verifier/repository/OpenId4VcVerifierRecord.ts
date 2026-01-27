import type { RecordTags, TagsBase } from '@credo-ts/core'
import { BaseRecord, utils } from '@credo-ts/core'
import type { OpenId4VpVerifierClientMetadata } from '../OpenId4VpVerifierServiceOptions'

export type OpenId4VcVerifierRecordTags = RecordTags<OpenId4VcVerifierRecord>

export type DefaultOpenId4VcVerifierRecordTags = {
  verifierId: string
}

export interface OpenId4VcVerifierRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  verifierId: string

  clientMetadata?: OpenId4VpVerifierClientMetadata
}

/**
 * For OID4VC you need to expos metadata files. Each issuer needs to host this metadata. This is not the case for DIDComm where we can just have one /didcomm endpoint.
 * So we create a record per openid issuer/verifier that you want, and each tenant can create multiple issuers/verifiers which have different endpoints
 * and metadata files
 * */
export class OpenId4VcVerifierRecord extends BaseRecord<DefaultOpenId4VcVerifierRecordTags> {
  public static readonly type = 'OpenId4VcVerifierRecord'
  public readonly type = OpenId4VcVerifierRecord.type

  public verifierId!: string
  public clientMetadata?: OpenId4VpVerifierClientMetadata

  public constructor(props: OpenId4VcVerifierRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.verifierId = props.verifierId
      this.clientMetadata = props.clientMetadata
    }
  }

  public getTags() {
    return {
      ...this._tags,
      verifierId: this.verifierId,
    }
  }
}
