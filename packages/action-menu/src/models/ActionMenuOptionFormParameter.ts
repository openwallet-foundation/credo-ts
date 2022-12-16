import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

/**
 * @public
 */
export enum ActionMenuFormInputType {
  Text = 'text',
}

/**
 * @public
 */
export interface ActionMenuFormParameterOptions {
  name: string
  title: string
  default?: string
  description: string
  required?: boolean
  type?: ActionMenuFormInputType
}

/**
 * @public
 */
export class ActionMenuFormParameter {
  public constructor(options: ActionMenuFormParameterOptions) {
    if (options) {
      this.name = options.name
      this.title = options.title
      this.default = options.default
      this.description = options.description
      this.required = options.required
      this.type = options.type
    }
  }

  @IsString()
  public name!: string

  @IsString()
  public title!: string

  @IsString()
  @IsOptional()
  public default?: string

  @IsString()
  public description!: string

  @IsBoolean()
  @IsOptional()
  public required?: boolean

  @IsEnum(ActionMenuFormInputType)
  @IsOptional()
  public type?: ActionMenuFormInputType
}
