// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
} from '@aries-framework/anoncreds'

import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  Contains,
  IsArray,
  IsInstance,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export class CheqdSchema {
  public constructor(options: Omit<AnonCredsSchema, 'issuerId'>) {
    if (options) {
      this.name = options.name
      this.attrNames = options.attrNames
      this.version = options.version
    }
  }

  @IsString()
  public name!: string

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  public attrNames!: string[]

  @IsString()
  public version!: string
}

export class CheqdCredentialDefinitionValue {
  @IsObject()
  public primary!: Record<string, unknown>

  @IsObject()
  @IsOptional()
  public revocation?: unknown
}

export class CheqdCredentialDefinition {
  public constructor(options: Omit<AnonCredsCredentialDefinition, 'issuerId'>) {
    if (options) {
      this.schemaId = options.schemaId
      this.type = options.type
      this.tag = options.tag
      this.value = options.value
    }
  }

  @IsString()
  public schemaId!: string

  @Contains('CL')
  public type!: 'CL'

  @IsString()
  public tag!: string

  @ValidateNested()
  @IsInstance(CheqdCredentialDefinitionValue)
  @Type(() => CheqdCredentialDefinitionValue)
  public value!: CheqdCredentialDefinitionValue
}

export class AccumKey {
  @IsString()
  public z!: string
}

export class PublicKeys {
  @ValidateNested()
  @IsInstance(AccumKey)
  @Type(() => AccumKey)
  public accumKey!: AccumKey
}

export class CheqdRevocationRegistryDefinitionValue {
  @ValidateNested()
  @IsInstance(PublicKeys)
  @Type(() => PublicKeys)
  public publicKeys!: PublicKeys

  @IsNumber()
  public maxCredNum!: number

  @IsString()
  public tailsLocation!: string

  @IsString()
  public tailsHash!: string
}

export class CheqdRevocationRegistryDefinition {
  public constructor(options: Omit<AnonCredsRevocationRegistryDefinition, 'issuerId'>) {
    if (options) {
      this.revocDefType = options.revocDefType
      this.credDefId = options.credDefId
      this.tag = options.tag
      this.value = options.value
    }
  }

  @Contains('CL_ACCUM')
  public revocDefType!: 'CL_ACCUM'

  @IsString()
  public credDefId!: string

  @IsString()
  public tag!: string

  @ValidateNested()
  @IsInstance(CheqdRevocationRegistryDefinitionValue)
  @Type(() => CheqdRevocationRegistryDefinitionValue)
  public value!: CheqdRevocationRegistryDefinitionValue
}

export class CheqdRevocationStatusList {
  public constructor(options: Omit<AnonCredsRevocationStatusList, 'issuerId'>) {
    if (options) {
      this.revRegDefId = options.revRegDefId
      this.revocationList = options.revocationList
      this.currentAccumulator = options.currentAccumulator
    }
  }

  @IsString()
  public revRegDefId!: string

  @IsNumber({}, { each: true })
  public revocationList!: number[]

  @IsString()
  public currentAccumulator!: string
}
