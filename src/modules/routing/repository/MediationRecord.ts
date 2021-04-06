import type { Verkey } from 'indy-sdk';
import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from '../../../storage/BaseRecord';

interface MediatorRecordProps {
  id: string;
  createdAt?: number;
  tags?: { [keys: string]: string };
  mediatorConnectionId: string;
  routingKeys: [Verkey]
  endPoint: string
}

export class MediationRecord extends BaseRecord {
  public mediatorConnectionId: string;
  public endPoint: string;
  public routingKeys: [Verkey];

  public static readonly type: RecordType = RecordType.ProvisioningRecord;
  public readonly type = MediationRecord.type;

  public constructor(props: MediatorRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.mediatorConnectionId = props.mediatorConnectionId;
    this.endPoint = props.endPoint;
    this.routingKeys = props.routingKeys;
    this.tags = props.tags || {};
  }
}
