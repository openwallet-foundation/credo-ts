import { BaseRecord, RecordType } from './BaseRecord';
import { DidDoc } from '../protocols/connections/domain/DidDoc';
import { InvitationDetails } from '../protocols/connections/domain/InvitationDetails';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { Connection } from '../protocols/connections/domain/Connection';

interface ConnectionProps {
  id: string;
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirDidDoc?: DidDoc;
  invitation?: InvitationDetails;
  state: ConnectionState;
  endpoint?: string;
}

export interface ConnectionStorageProps extends ConnectionProps {
  id: string;
  tags: { [keys: string]: string };
}

export class ConnectionRecord extends BaseRecord implements ConnectionStorageProps {
  public did: Did;
  public didDoc: DidDoc;
  public verkey: Verkey;
  public theirDid?: Did;
  public theirDidDoc?: DidDoc;
  public invitation?: InvitationDetails;
  public state: ConnectionState;
  public endpoint?: string;

  public static readonly type: RecordType = RecordType.ConnectionRecord;
  public readonly type = ConnectionRecord.type;

  public constructor(props: ConnectionStorageProps) {
    super(props.id);
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

  public get myKey() {
    if (!this.didDoc) {
      return null;
    }
    return this.didDoc.service[0].recipientKeys[0];
  }

  public get theirKey() {
    if (!this.theirDidDoc) {
      return null;
    }
    return this.theirDidDoc.service[0].recipientKeys[0];
  }

  public updateDidExchangeConnection(didExchangeConnection: Connection) {
    this.theirDid = didExchangeConnection.did;
    this.theirDidDoc = didExchangeConnection.didDoc;
  }
}
