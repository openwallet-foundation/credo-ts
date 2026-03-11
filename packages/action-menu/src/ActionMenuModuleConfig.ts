export interface ActionMenuModuleConfigOptions {
  /**
   * Strict state checking for Action Menu
   *
   * If true, check current protocol state before executing an action. Otherwise, allow action processing regardless of previous action.
   * 
   * @default true
   */
  strictStateChecking?: boolean
}

/**
 * @public
 */
export class ActionMenuModuleConfig {
  private options: ActionMenuModuleConfigOptions

  public constructor(options: ActionMenuModuleConfigOptions) {
    this.options = options
  }

  public get strictStateChecking() {
    return this.options.strictStateChecking ?? true
  }
}
