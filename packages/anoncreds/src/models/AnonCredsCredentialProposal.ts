import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export interface AnonCredsCredentialProposalOptions {
  /**
   * @deprecated Use `schemaIssuerId` instead. Only valid for legacy indy identifiers.
   */
  schemaIssuerDid?: string
  schemaIssuerId?: string

  schemaId?: string
  schemaName?: string
  schemaVersion?: string
  credentialDefinitionId?: string

  /**
   * @deprecated Use `issuerId` instead. Only valid for legacy indy identifiers.
   */
  issuerDid?: string
  issuerId?: string
}

/**
 * Class representing an AnonCreds credential proposal as defined in Aries RFC 0592 (and soon the new AnonCreds RFC)
 */
export class AnonCredsCredentialProposal {
  public constructor(options: AnonCredsCredentialProposalOptions) {
    if (options) {
      this.schemaIssuerDid = options.schemaIssuerDid
      this.schemaIssuerId = options.schemaIssuerId
      this.schemaId = options.schemaId
      this.schemaName = options.schemaName
      this.schemaVersion = options.schemaVersion
      this.credentialDefinitionId = options.credentialDefinitionId
      this.issuerDid = options.issuerDid
      this.issuerId = options.issuerId
    }
  }

  /**
   * Filter to request credential based on a particular Schema issuer DID.
   *
   * May only be used with legacy indy identifiers
   *
   * @deprecated Use schemaIssuerId instead
   */
  @Expose({ name: 'schema_issuer_did' })
  @IsString()
  @IsOptional()
  public schemaIssuerDid?: string

  /**
   * Filter to request credential based on a particular Schema issuer DID.
   */
  @Expose({ name: 'schema_issuer_id' })
  @IsString()
  @IsOptional()
  public schemaIssuerId?: string

  /**
   * Filter to request credential based on a particular Schema.
   */
  @Expose({ name: 'schema_id' })
  @IsString()
  @IsOptional()
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
  public schemaVersion?: string

  /**
   * Filter to request credential based on a particular Credential Definition.
   */
  @Expose({ name: 'cred_def_id' })
  @IsString()
  @IsOptional()
  public credentialDefinitionId?: string

  /**
   * Filter to request a credential issued by the owner of a particular DID.
   *
   * May only be used with legacy indy identifiers
   *
   * @deprecated Use issuerId instead
   */
  @Expose({ name: 'issuer_did' })
  @IsString()
  @IsOptional()
  public issuerDid?: string

  /**
   * Filter to request a credential issued by the owner of a particular DID.
   */
  @Expose({ name: 'issuer_id' })
  @IsString()
  @IsOptional()
  public issuerId?: string
}
