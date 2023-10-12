import { inject, injectable, InjectionSymbols, Logger } from '@aries-framework/core'

/**
 * @internal
 */
@injectable()
export class SdJwtService {
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }
}
