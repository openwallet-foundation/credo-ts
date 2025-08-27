import { IsStringOrStringArray, JsonTransformer } from '@credo-ts/core'
import { Type, Expose, Transform } from 'class-transformer'
import {
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsObject,
  Validate,
  IsNumber,
} from 'class-validator'

export class WebVhSchemaContent {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  public attrNames!: string[]

  @IsString()
  public name!: string

  @IsString()
  public version!: string

  @IsOptional()
  @IsString()
  public issuerId?: string
}

export class WebVhCredDefContent {
  @IsString()
  public issuerId!: string

  @IsString()
  public schemaId!: string

  @IsString()
  public type!: string

  @IsString()
  public tag!: string

  @IsObject()
  public value!: Record<string, unknown>
}

export class WebVhRevRegDefContent {
  @IsString()
  public issuerId!: string

  @IsString()
  public revocDefType!: string

  @IsString()
  public credDefId!: string

  @IsString()
  public tag!: string

  @IsObject()
  public value!: {
    publicKeys: { accumKey: { z: string } }
    maxCredNum: number
    tailsLocation: string
    tailsHash: string
  }
}

export class WebVhRevocationStatusListContent {
  @IsString()
  public issuerId!: string

  @IsString()
  public revRegDefId!: string

  @IsArray()
  @IsNumber({}, { each: true })
  public revocationList!: number[]

  @IsString()
  public currentAccumulator!: string

  @IsNumber()
  public timestamp!: number
}

export class WebVhProof {
  @IsString()
  public type!: string

  @IsString()
  public cryptosuite!: string

  @IsString()
  public proofPurpose!: string

  @IsString()
  public proofValue!: string

  @IsString()
  public verificationMethod!: string
}

export class WebVhResource {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  public '@context'!: string[]

  @Validate(IsStringOrStringArray)
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @Type(() => String)
  public type!: string[]

  @IsString()
  public id!: string

  @Expose()
  @Transform(({ value }) => {
    if (value && 'attrNames' in value) {
      return JsonTransformer.fromJSON(value, WebVhSchemaContent)
    } else if (value && 'schemaId' in value) {
      return JsonTransformer.fromJSON(value, WebVhCredDefContent)
    } else if (value && 'revocDefType' in value) {
      return JsonTransformer.fromJSON(value, WebVhRevRegDefContent)
    }
    return value
  })
  public content!: WebVhSchemaContent | WebVhCredDefContent | WebVhRevRegDefContent | WebVhRevocationStatusListContent

  @ValidateNested()
  @Type(() => WebVhProof)
  public proof!: WebVhProof

  @IsOptional()
  public metadata?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebVhLink)
  public links?: WebVhLink[]
}

export class WebVhLink {
  @IsString()
  public id!: string

  @IsString()
  public type!: string

  @IsOptional()
  @IsNumber()
  public timestamp?: number

  @IsOptional()
  @IsString()
  public digestMultibase!: string
}
