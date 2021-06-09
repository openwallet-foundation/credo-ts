import type { Logger } from '../../../logger'
import type { ProvisioningRepository } from '../repository'
import type { Verkey } from 'indy-sdk'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { RecordNotFoundError } from '../../../error'
import { ProvisioningRecord } from '../repository/ProvisioningRecord'

const UNIQUE_PROVISIONING_ID = 'UNIQUE_PROVISIONING_ID'

@scoped(Lifecycle.ContainerScoped)
export class ProvisioningService {
  private provisioningRepository: ProvisioningRepository
  private logger: Logger

  public constructor(provisioningRepository: ProvisioningRepository, @inject(InjectionSymbols.Logger) logger: Logger) {
    this.provisioningRepository = provisioningRepository
    this.logger = logger
  }

  public async find(): Promise<ProvisioningRecord | null> {
    try {
      return await this.provisioningRepository.getById(UNIQUE_PROVISIONING_ID)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        this.logger.debug(`Provision record with id '${UNIQUE_PROVISIONING_ID}' not found.`, {
          error,
        })
        return null
      } else {
        throw error
      }
    }
  }

  public async create({ mediatorConnectionId, mediatorPublicVerkey }: ProvisioningProps): Promise<ProvisioningRecord> {
    const provisioningRecord = new ProvisioningRecord({
      id: UNIQUE_PROVISIONING_ID,
      mediatorConnectionId,
      mediatorPublicVerkey,
    })
    await this.provisioningRepository.save(provisioningRecord)
    return provisioningRecord
  }
}

export interface ProvisioningProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}
