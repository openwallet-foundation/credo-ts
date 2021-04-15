import type { Verkey } from 'indy-sdk';
import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from '../../../storage/BaseRecord';

<<<<<<< HEAD:src/modules/routing/repository/MediationRecord.ts
interface MediatorRecordProps {
=======
interface MediationRecipientRecordProps {
>>>>>>> 0e66bc6e423dca521a99fc638c16825fc0d0294c:src/modules/routing/repository/MediationRecipientRecord.ts
  id: string;
  createdAt?: number;
  tags?: { [keys: string]: string };
  mediatorConnectionId: string;
  routingKeys: [Verkey]
  endPoint: string
}

<<<<<<< HEAD:src/modules/routing/repository/MediationRecord.ts
export class MediationRecord extends BaseRecord {
=======
export class MediationRecipientRecord extends BaseRecord {
>>>>>>> 0e66bc6e423dca521a99fc638c16825fc0d0294c:src/modules/routing/repository/MediationRecipientRecord.ts
  public mediatorConnectionId: string;
  public endPoint: string;
  public routingKeys: [Verkey];

  public static readonly type: RecordType = RecordType.ProvisioningRecord;
<<<<<<< HEAD:src/modules/routing/repository/MediationRecord.ts
  public readonly type = MediationRecord.type;

  public constructor(props: MediatorRecordProps) {
=======
  public readonly type = MediationRecipientRecord.type;

  public constructor(props: MediationRecipientRecordProps) {
>>>>>>> 0e66bc6e423dca521a99fc638c16825fc0d0294c:src/modules/routing/repository/MediationRecipientRecord.ts
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.mediatorConnectionId = props.mediatorConnectionId;
    this.endPoint = props.endPoint;
    this.routingKeys = props.routingKeys;
    this.tags = props.tags || {};
  }
}
