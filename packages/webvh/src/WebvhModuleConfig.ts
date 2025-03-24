import { injectable } from 'tsyringe'

export interface WebvhModuleConfigOptions {
  /**
   * Base URL for the WebVH service
   */
  baseUrl?: string
}

@injectable()
export class WebvhModuleConfig {
  private options: WebvhModuleConfigOptions

  public constructor(options?: WebvhModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link WebvhModuleConfigOptions.baseUrl} */
  public get baseUrl() {
    return this.options.baseUrl ?? 'https://webvh.io'
  }
}
