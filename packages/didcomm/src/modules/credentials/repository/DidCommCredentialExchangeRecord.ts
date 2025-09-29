import type { TagsBase } from '@credo-ts/core'
import type { DidCommCredentialRole } from '../models'
import type { DidCommAutoAcceptCredential } from '../models/DidCommCredentialAutoAcceptType'
import type { DidCommCredentialState } from '../models/DidCommCredentialState'
import { DidCommRevocationNotification } from '../models/DidCommRevocationNotification'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'
import { Type } from 'class-transformer'

import { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import { DidCommCredentialPreviewAttribute } from '../models/DidCommCredentialPreviewAttribute'

export interface DidCommCredentialExchangeRecordProps {
  id?: string
  createdAt?: Date
  state: DidCommCredentialState
  role: DidCommCredentialRole
  connectionId?: string
  threadId: string
  parentThreadId?: string
  protocolVersion: string

  tags?: CustomDidCommCredentialExchangeTags
  credentialAttributes?: DidCommCredentialPreviewAttribute[]
  autoAcceptCredential?: DidCommAutoAcceptCredential
  linkedAttachments?: DidCommAttachment[]
  revocationNotification?: DidCommRevocationNotification
  errorMessage?: string
  credentials?: CredentialRecordBinding[]
}

export type CustomDidCommCredentialExchangeTags = TagsBase
export type DefaultDidCommCredentialExchangeTags = {
  threadId: string
  parentThreadId?: string
  connectionId?: string
  state: DidCommCredentialState
  role: DidCommCredentialRole
  credentialIds: string[]
}

export interface CredentialRecordBinding {
  credentialRecordType: string
  credentialRecordId: string
}

export class DidCommCredentialExchangeRecord extends BaseRecord<
  DefaultDidCommCredentialExchangeTags,
  CustomDidCommCredentialExchangeTags
> {
  public connectionId?: string
  public threadId!: string
  public parentThreadId?: string
  public state!: DidCommCredentialState
  public role!: DidCommCredentialRole
  public autoAcceptCredential?: DidCommAutoAcceptCredential

  @Type(() => DidCommRevocationNotification)
  public revocationNotification?: DidCommRevocationNotification
  public errorMessage?: string
  public protocolVersion!: string
  public credentials: CredentialRecordBinding[] = []

  @Type(() => DidCommCredentialPreviewAttribute)
  public credentialAttributes?: DidCommCredentialPreviewAttribute[]

  @Type(() => DidCommAttachment)
  public linkedAttachments?: DidCommAttachment[]

  // Type is CredentialRecord on purpose (without Exchange) as this is how the record was initially called.
  public static readonly type = 'CredentialRecord'
  public readonly type = DidCommCredentialExchangeRecord.type

  public constructor(props: DidCommCredentialExchangeRecordProps) {
    super()
    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.state = props.state
      this.role = props.role
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this.parentThreadId = props.parentThreadId
      this.protocolVersion = props.protocolVersion
      this._tags = props.tags ?? {}

      this.credentialAttributes = props.credentialAttributes
      this.autoAcceptCredential = props.autoAcceptCredential
      this.linkedAttachments = props.linkedAttachments
      this.revocationNotification = props.revocationNotification
      this.errorMessage = props.errorMessage
      this.credentials = props.credentials || []
    }
  }

  public getTags() {
    const ids = this.credentials.map((c) => c.credentialRecordId)

    return {
      ...this._tags,
      threadId: this.threadId,
      parentThreadId: this.parentThreadId,
      connectionId: this.connectionId,
      state: this.state,
      role: this.role,
      credentialIds: ids,
    }
  }

  public assertProtocolVersion(version: string) {
    if (this.protocolVersion !== version) {
      throw new CredoError(
        `Credential record has invalid protocol version ${this.protocolVersion}. Expected version ${version}`
      )
    }
  }

  public assertState(expectedStates: DidCommCredentialState | DidCommCredentialState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Credential record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (!this.connectionId) {
      throw new CredoError(
        'Credential record is not associated with any connection. This is often the case with connection-less credential exchange'
      )
    }
    if (this.connectionId !== currentConnectionId) {
      throw new CredoError(
        `Credential record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
