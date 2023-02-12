import { injectable } from '@aries-framework/core'

import { IndySdkToAskarMigrationError } from './errors/IndySdkToAskarMigrationError'
import { IndySdkToAskarMigrationService } from './services/IndySdkToAskarMigrationService'

/**
 * @internal
 */
@injectable()
export class IndySdkToAskarMigrationApi {
  private indySdkToAskarMigrationService: IndySdkToAskarMigrationService

  public constructor(indySdkToAskarMigrationService: IndySdkToAskarMigrationService) {
    this.indySdkToAskarMigrationService = indySdkToAskarMigrationService
  }

  /**
   * Start the migration process from a legacy indy-sdk based
   * storage to the new Aries Askar based storage
   *
   */
  public async migrate() {
    try {
      await this.indySdkToAskarMigrationService.migrate()
    } catch (e) {
      throw new IndySdkToAskarMigrationError(
        'Something went wrong while trying to migrate to the new askar storage. ',
        { ...e }
      )
    }
  }
}
