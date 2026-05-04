import { JsonTransformer } from '@credo-ts/core'
import { Expose, Transform, Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsNumber, IsObject, IsOptional, IsString } from 'class-validator'
import { WebVhAttestedResource } from '../../resources'

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

export class WebVhAnonCredsResource extends WebVhAttestedResource {
  @Expose()
  @Transform(({ value }) => {
    if (value && 'attrNames' in value) {
      return JsonTransformer.fromJSON(value, WebVhSchemaContent)
    }
    if (value && 'schemaId' in value) {
      return JsonTransformer.fromJSON(value, WebVhCredDefContent)
    }
    if (value && 'revocDefType' in value) {
      return JsonTransformer.fromJSON(value, WebVhRevRegDefContent)
    }
    return value
  })
  public content!: WebVhSchemaContent | WebVhCredDefContent | WebVhRevRegDefContent | WebVhRevocationStatusListContent
}
