import type { Verkey } from 'indy-sdk';
import { Repository } from '../../../storage/Repository';
import { MediationRecord, MediatonRecord } from '../repository/MediationRecord';
import { isIndyError } from '../../../utils/indyError';
import { AgentConfig } from '../../../agent/AgentConfig';
import { Logger } from '../../../logger';

const UNIQUE_PROVISIONING_ID = 'UNIQUE_PROVISIONING_ID';

export class ProvisioningService {
  private provisioningRepository: Repository<ProvisioningRecord>;
  private logger: Logger;
  private endpoint: String;
  private routingKeys: [Verkey];

  public constructor(provisioningRepository: Repository<ProvisioningRecord>, agentConfig: AgentConfig) {
    this.provisioningRepository = provisioningRepository;
    this.logger = agentConfig.logger;
    this.endpoint = provisioningRepository.endpoint;
    this.routingKeys = provisioningRepository.routingKeys;
  }

  public async find(): Promise<ProvisioningRecord | null> {
    try {
      const provisioningRecord = await this.provisioningRepository.find(UNIQUE_PROVISIONING_ID);
      return provisioningRecord;
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        this.logger.debug(`Provision record with id '${UNIQUE_PROVISIONING_ID}' not found.`, {
          indyError: 'WalletItemNotFound',
        });
        return null;
      } else {
        throw error;
      }
    }
  }

  public async create({ mediatorConnectionId, mediatorPublicVerkey }: ProvisioningProps): Promise<MediationRecord> {
    const provisioningRecord = new MediationRecord({
      id: UNIQUE_PROVISIONING_ID,
      mediatorConnectionId,
      routingKeys,
      endpoint,
    });
    await this.provisioningRepository.save(provisioningRecord);
    return provisioningRecord;
  }
}

interface ProvisioningProps {
  mediatorConnectionId: string;
  mediatorPublicVerkey: Verkey;
}
