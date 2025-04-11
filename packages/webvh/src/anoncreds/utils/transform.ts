import { Type, Expose, Transform } from 'class-transformer'
import {
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsObject,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  IsNumber,
} from 'class-validator'

@ValidatorConstraint({ name: 'isStringOrStringArray', async: false })
export class IsStringOrStringArray implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public validate(value: unknown, _args: ValidationArguments) {
    if (typeof value === 'string') {
      return true
    }
    if (Array.isArray(value)) {
      return value.every((item) => typeof item === 'string')
    }
    return false
  }

  public defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a string or an array of strings`
  }
}

export class WebVhSchemaContent {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1) // Example validation: ensure attrNames is not empty
  @Type(() => String)
  public attrNames!: string[]

  @IsString() // Example validation
  public name!: string

  @IsString() // Example validation
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
  @Transform(({ value }) => (Array.isArray(value) ? value : [value])) // Normalize to array after validation
  @Type(() => String) // Keep Type for transformation if needed
  public type!: string[] // Keep as array internally after normalization

  @IsString()
  public id!: string

  @Expose()
  @Transform(({ value }) => {
    // Determine which class to use based on the content
    if (value && 'attrNames' in value) {
      return Object.assign(new WebVhSchemaContent(), value)
    } else if (value && 'schemaId' in value) {
      return Object.assign(new WebVhCredDefContent(), value)
    } else if (value && 'revocDefType' in value) {
      return Object.assign(new WebVhRevRegDefContent(), value)
    }
    return value
  })
  public content!: WebVhSchemaContent | WebVhCredDefContent | WebVhRevRegDefContent

  @ValidateNested()
  @Type(() => WebVhProof)
  public proof!: WebVhProof

  @IsOptional()
  // Add validation if metadata structure is known
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
}
