import { Repository } from '../storage/Repository';
import { ProvisioningRecord } from '../storage/ProvisioningRecord';
import logger from '../logger';
import { isIndyError } from '../utils/indyError';

const UNIQUE_PROVISIONING_ID = 'UNIQUE_PROVISIONING_ID';

export class ProvisioningService {
  private provisioningRepository: Repository<ProvisioningRecord>;

  public constructor(provisioningRepository: Repository<ProvisioningRecord>) {
    this.provisioningRepository = provisioningRepository;
  }

  public async find(): Promise<ProvisioningRecord | null> {
    try {
      const provisioningRecord = await this.provisioningRepository.find(UNIQUE_PROVISIONING_ID);
      return provisioningRecord;
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        logger.log('WalletItemNotFound');
        return null;
      } else {
        throw error;
      }
    }
  }

  public async create({ mediatorConnectionId, mediatorPublicVerkey }: ProvisioningProps): Promise<ProvisioningRecord> {
    const provisioningRecord = new ProvisioningRecord({
      id: UNIQUE_PROVISIONING_ID,
      mediatorConnectionId,
      mediatorPublicVerkey,
    });
    await this.provisioningRepository.save(provisioningRecord);
    return provisioningRecord;
  }
}

interface ProvisioningProps {
  mediatorConnectionId: string;
  mediatorPublicVerkey: Verkey;
}
