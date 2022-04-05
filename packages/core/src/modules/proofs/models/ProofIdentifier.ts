import { Expose } from 'class-transformer'
import { IsNumber, IsOptional, IsString, Matches } from 'class-validator'

import { credDefIdRegex } from '../../../utils'

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
  @Matches(credDefIdRegex)
  public credentialDefinitionId!: string

  @Expose({ name: 'rev_reg_id' })
  @IsOptional()
  @IsString()
  public revocationRegistryId?: string

  @IsOptional()
  @IsNumber()
  public timestamp?: number
}
