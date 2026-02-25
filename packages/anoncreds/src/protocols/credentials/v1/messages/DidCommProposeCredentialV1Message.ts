import type { DidCommAttachment } from '@credo-ts/didcomm'

import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, Matches, ValidateNested } from 'class-validator'

import {
  unqualifiedCredentialDefinitionIdRegex,
  unqualifiedIndyDidRegex,
  unqualifiedSchemaIdRegex,
  unqualifiedSchemaVersionRegex,
} from '../../../../utils'

import { DidCommCredentialV1Preview } from './DidCommCredentialV1Preview'

export interface DidCommProposeCredentialV1MessageOptions {
  id?: string
  comment?: string
  credentialPreview?: DidCommCredentialV1Preview
  schemaIssuerDid?: string
  schemaId?: string
  schemaName?: string
  schemaVersion?: string
  credentialDefinitionId?: string
  issuerDid?: string
  attachments?: DidCommAttachment[]
}

/**
 * Message part of Issue Credential Protocol used to initiate credential exchange by prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#propose-credential
 */
export class DidCommProposeCredentialV1Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: DidCommProposeCredentialV1MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.schemaIssuerDid = options.schemaIssuerDid
      this.schemaId = options.schemaId
      this.schemaName = options.schemaName
      this.schemaVersion = options.schemaVersion
      this.credentialDefinitionId = options.credentialDefinitionId
      this.issuerDid = options.issuerDid
      this.appendedAttachments = options.attachments
    }
  }

  @IsValidMessageType(DidCommProposeCredentialV1Message.type)
  public readonly type = DidCommProposeCredentialV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/propose-credential')

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  /**
   * Represents the credential data that Prover wants to receive.
   */
  @Expose({ name: 'credential_proposal' })
  @Type(() => DidCommCredentialV1Preview)
  @ValidateNested()
  @IsOptional()
  @IsInstance(DidCommCredentialV1Preview)
  public credentialPreview?: DidCommCredentialV1Preview

  /**
   * Filter to request credential based on a particular Schema issuer DID.
   */
  @Expose({ name: 'schema_issuer_did' })
  @IsString()
  @IsOptional()
  @Matches(unqualifiedIndyDidRegex)
  public schemaIssuerDid?: string

  /**
   * Filter to request credential based on a particular Schema.
   */
  @Expose({ name: 'schema_id' })
  @IsString()
  @IsOptional()
  @Matches(unqualifiedSchemaIdRegex)
  public schemaId?: string

  /**
   * Filter to request credential based on a schema name.
   */
  @Expose({ name: 'schema_name' })
  @IsString()
  @IsOptional()
  public schemaName?: string

  /**
   * Filter  to request credential based on a schema version.
   */
  @Expose({ name: 'schema_version' })
  @IsString()
  @IsOptional()
  @Matches(unqualifiedSchemaVersionRegex, {
    message: 'Version must be X.X or X.X.X',
  })
  public schemaVersion?: string

  /**
   * Filter to request credential based on a particular Credential Definition.
   */
  @Expose({ name: 'cred_def_id' })
  @IsString()
  @IsOptional()
  @Matches(unqualifiedCredentialDefinitionIdRegex)
  public credentialDefinitionId?: string

  /**
   * Filter to request a credential issued by the owner of a particular DID.
   */
  @Expose({ name: 'issuer_did' })
  @IsString()
  @IsOptional()
  @Matches(unqualifiedIndyDidRegex)
  public issuerDid?: string
}
