import { Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, IsString } from 'class-validator'

import { JsonTransformer } from '../../../../../utils/JsonTransformer'

export interface FieldOptions {
  path: string[]
  filter: {
    type: string
    minimum: string
  }
}

export interface ConstraintOptions {
  fields: FieldOptions[]
}

export interface SchemaOptions {
  uri: string
}

export interface InputDescriptorsOptions {
  id: string
  name: string
  group: string[]
  schema: SchemaOptions[]
  constraints: ConstraintOptions
}

export class InputDescriptors {
  public constructor(options: InputDescriptorsOptions) {
    if (options) {
      this.id = options.id
      this.name = options.name
      this.group = options.group
      this.schema = options.schema
      this.constraints = options.constraints
    }
  }

  @IsOptional()
  @IsString()
  public id?: string

  @IsString()
  public name!: string

  @IsString()
  @IsOptional()
  @IsArray()
  public group!: string[]

  @IsArray()
  public schema!: SchemaOptions[]

  public constraints!: ConstraintOptions
}

export interface InputDescriptorsSchemaOptions {
  inputDescriptors: InputDescriptors[]
}

export class InputDescriptorsSchema {
  public constructor(options: InputDescriptorsSchemaOptions) {
    this.inputDescriptors = options.inputDescriptors
  }

  @Type(() => InputDescriptors)
  @Expose({ name: 'input_descriptors' })
  public inputDescriptors: InputDescriptors[]

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }
}
