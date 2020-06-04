import { BaseRecord, RecordType } from './BaseRecord';

interface ProvisioningRecordProps {
  id: string;
  tags?: { [keys: string]: string };
  agencyConnectionVerkey: Verkey;
  agencyPublicVerkey: Verkey;
}

export class ProvisioningRecord extends BaseRecord {
  agencyConnectionVerkey: Verkey;
  agencyPublicVerkey: Verkey;

  type = RecordType.ProvisioningRecord;
  static type: RecordType = RecordType.ProvisioningRecord;

  constructor(props: ProvisioningRecordProps) {
    super(props.id);
    this.agencyConnectionVerkey = props.agencyConnectionVerkey;
    this.agencyPublicVerkey = props.agencyPublicVerkey;
    this.tags = props.tags || {};
  }
}
