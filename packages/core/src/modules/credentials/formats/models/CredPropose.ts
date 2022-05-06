import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export interface CredProposeOptions {
  schemaIssuerDid?: string
  schemaId?: string
  schemaName?: string
  schemaVersion?: string
  credentialDefinitionId?: string
  issuerDid?: string
}

/**
 * Class providing validation for the V2 credential proposal payload.
 *
 * The v1 message contains the properties directly in the message, which means they are
 * validated using the class validator decorators. In v2 the attachments content is not transformed
 * when transforming the message to a class instance so the content is not verified anymore, hence this
 * class.
 *
 */
export class CredPropose {
  public constructor(options: CredProposeOptions) {
    if (options) {
      this.schemaIssuerDid = options.schemaIssuerDid
      this.schemaId = options.schemaId
      this.schemaName = options.schemaName
      this.schemaVersion = options.schemaVersion
      this.credentialDefinitionId = options.credentialDefinitionId
      this.issuerDid = options.issuerDid
    }
  }

  /**
   * Filter to request credential based on a particular Schema issuer DID.
   */
  @Expose({ name: 'schema_issuer_did' })
  @IsString()
  @IsOptional()
  public schemaIssuerDid?: string

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
   */
  @Expose({ name: 'issuer_did' })
  @IsString()
  @IsOptional()
  public issuerDid?: string
}
