import { BaseRecord, RecordType } from './BaseRecord';
import { ConnectionProps } from '../protocols/connections/domain/Connection';
import { DidDoc } from '../protocols/connections/domain/DidDoc';
import { InvitationDetails } from '../protocols/connections/domain/InvitationDetails';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import uuid from 'uuid/v4';

export interface ConnectionStorageProps extends ConnectionProps {
  id?: string;
  tags: { [keys: string]: string };
}

export class ConnectionRecord extends BaseRecord implements ConnectionStorageProps {
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirDidDoc?: DidDoc;
  invitation?: InvitationDetails;
  state: ConnectionState;
  endpoint?: string;

  type = RecordType.ConnectionRecord;
  static type: RecordType = RecordType.ConnectionRecord;

  constructor(props: ConnectionStorageProps) {
    super(props.id ? props.id : uuid());
    this.did = props.did;
    this.didDoc = props.didDoc;
    this.verkey = props.verkey;
    this.theirDid = props.theirDid;
    this.theirDidDoc = props.theirDidDoc;
    this.invitation = props.invitation;
    this.state = props.state;
    this.endpoint = props.endpoint;
    this.tags = props.tags as { [keys: string]: string };
  }
}
