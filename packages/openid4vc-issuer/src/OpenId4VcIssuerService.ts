import {
  InjectionSymbols,
  JwsService,
  Logger,
  W3cCredentialRepository,
  W3cCredentialService,
  inject,
  injectable,
} from '@aries-framework/core'

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private w3cCredentialRepository: W3cCredentialRepository
  private jwsService: JwsService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    w3cCredentialService: W3cCredentialService,
    w3cCredentialRepository: W3cCredentialRepository,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.w3cCredentialRepository = w3cCredentialRepository
    this.jwsService = jwsService
    this.logger = logger
  }
}
