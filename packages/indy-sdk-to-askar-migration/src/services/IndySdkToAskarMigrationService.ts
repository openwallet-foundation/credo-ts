import type { Logger } from '@aries-framework/core'

import { injectable, AgentConfig } from '@aries-framework/core'

import { IndySdkToAskarMigrationError } from '../errors/IndySdkToAskarMigrationError'

/**
 * @internal
 */
@injectable()
export class IndySdkToAskarMigrationService {
  private logger: Logger
  private masterPassword: string
  private walletPath: string

  public constructor(agentConfig: AgentConfig) {
    if (!agentConfig.walletConfig) {
      throw new IndySdkToAskarMigrationError('no walletConfig found on the agentConfig')
    }

    this.logger = agentConfig.logger
    this.masterPassword = agentConfig.walletConfig.key
  }

  public async migrate() {
    this.logger.info('Starting migrating from an indy-sdk based wallet to an aries askar based wallet')
  }
}
