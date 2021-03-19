import type { Verkey } from 'indy-sdk';
import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from '../../../storage/BaseRecord';

interface MediationRecipientRecordProps {
  id: string;
  createdAt?: number;
  tags?: { [keys: string]: string };
  mediatorConnectionId: string;
  mediatorPublicVerkey: Verkey;
}

export class MediationRecipientRecord extends BaseRecord {
  public mediatorConnectionId: string;
  public mediatorPublicVerkey: Verkey;

  public static readonly type: RecordType = RecordType.ProvisioningRecord;
  public readonly type = MediationRecipientRecord.type;

  public constructor(props: MediationRecipientRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.mediatorConnectionId = props.mediatorConnectionId;
    this.mediatorPublicVerkey = props.mediatorPublicVerkey;
    this.tags = props.tags || {};
  }
}
