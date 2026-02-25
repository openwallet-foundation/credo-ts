import { Type } from 'class-transformer'
import { IsInstance, IsString } from 'class-validator'
import type { ActionMenuOptionOptions } from './ActionMenuOption'

import { ActionMenuOption } from './ActionMenuOption'

/**
 * @public
 */
export interface ActionMenuOptions {
  title: string
  description: string
  options: ActionMenuOptionOptions[]
}

/**
 * @public
 */
export class ActionMenu {
  public constructor(options: ActionMenuOptions) {
    if (options) {
      this.title = options.title
      this.description = options.description
      this.options = options.options.map((p) => new ActionMenuOption(p))
    }
  }

  @IsString()
  public title!: string

  @IsString()
  public description!: string

  @IsInstance(ActionMenuOption, { each: true })
  @Type(() => ActionMenuOption)
  public options!: ActionMenuOption[]
}
