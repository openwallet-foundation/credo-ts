import { BaseRecord, RecordType } from './BaseRecord';

interface ProvisioningRecordProps {
  id: string;
  tags?: { [keys: string]: string };
  agencyConnectionId: string;
  agencyPublicVerkey: Verkey;
}

export class ProvisioningRecord extends BaseRecord {
  public agencyConnectionId: string;
  public agencyPublicVerkey: Verkey;

  public static readonly type: RecordType = RecordType.ProvisioningRecord;
  public readonly type = ProvisioningRecord.type;

  public constructor(props: ProvisioningRecordProps) {
    super(props.id);
    this.agencyConnectionId = props.agencyConnectionId;
    this.agencyPublicVerkey = props.agencyPublicVerkey;
    this.tags = props.tags || {};
  }
}
