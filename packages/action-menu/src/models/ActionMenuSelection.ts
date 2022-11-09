import { IsOptional, IsString } from 'class-validator'

export interface ActionMenuSelectionOptions {
  name: string
  params?: Record<string, string>
}

export class ActionMenuSelection {
  public constructor(options: ActionMenuSelectionOptions) {
    if (options) {
      this.name = options.name
      this.params = options.params
    }
  }

  @IsString()
  public name!: string

  @IsString({ each: true })
  @IsOptional()
  public params?: Record<string, string>
}
