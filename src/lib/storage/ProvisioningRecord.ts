import { BaseRecord, RecordType } from './BaseRecord';

interface ProvisioningRecordProps {
  id: string;
  tags?: { [keys: string]: string };
  agencyConnectionId: string;
  agencyPublicVerkey: Verkey;
}

export class ProvisioningRecord extends BaseRecord {
  agencyConnectionId: string;
  agencyPublicVerkey: Verkey;

  type = RecordType.ProvisioningRecord;
  static type: RecordType = RecordType.ProvisioningRecord;

  constructor(props: ProvisioningRecordProps) {
    super(props.id);
    this.agencyConnectionId = props.agencyConnectionId;
    this.agencyPublicVerkey = props.agencyPublicVerkey;
    this.tags = props.tags || {};
  }
}
