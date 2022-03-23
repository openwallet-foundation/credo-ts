import { Expose } from 'class-transformer'
import { IsNumber, IsOptional, IsString, Matches } from 'class-validator'

export class ProofIdentifier {
  public constructor(options: ProofIdentifier) {
    if (options) {
      this.schemaId = options.schemaId
      this.credentialDefinitionId = options.credentialDefinitionId
      this.revocationRegistryId = options.revocationRegistryId
      this.timestamp = options.timestamp
    }
  }

  @Expose({ name: 'schema_id' })
  @IsString()
  public schemaId!: string

  @Expose({ name: 'cred_def_id' })
  @IsString()
  @Matches(/^([a-zA-Z0-9]{21,22}):3:CL:(([1-9][0-9]*)|([a-zA-Z0-9]{21,22}:2:.+:[0-9.]+)):(.+)?$/)
  public credentialDefinitionId!: string

  @Expose({ name: 'rev_reg_id' })
  @IsOptional()
  @IsString()
  public revocationRegistryId?: string

  @IsOptional()
  @IsNumber()
  public timestamp?: number
}
