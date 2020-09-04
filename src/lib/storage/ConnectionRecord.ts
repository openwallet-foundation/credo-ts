import { BaseRecord, RecordType, Tags } from './BaseRecord';
import { DidDoc } from '../protocols/connections/domain/DidDoc';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { Connection } from '../protocols/connections/domain/Connection';
import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';
import { ConnectionRole } from '../protocols/connections/domain/ConnectionRole';

interface ConnectionProps {
  id: string;
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirDidDoc?: DidDoc;
  invitation?: ConnectionInvitationMessage;
  state: ConnectionState;
  role: ConnectionRole;
  endpoint?: string;
  alias?: string;
  autoAcceptConnection?: boolean;
}

export interface ConnectionTags extends Tags {
  invitationKey?: string;
  threadId?: string;
  verkey?: string;
  theirKey?: string;
}

export interface ConnectionStorageProps extends ConnectionProps {
  tags: ConnectionTags;
}

export class ConnectionRecord extends BaseRecord implements ConnectionStorageProps {
  public did: Did;
  public didDoc: DidDoc;
  public verkey: Verkey;
  public theirDid?: Did;
  public theirDidDoc?: DidDoc;
  public invitation?: ConnectionInvitationMessage;
  public state: ConnectionState;
  public role: ConnectionRole;
  public endpoint?: string;
  public alias?: string;
  public autoAcceptConnection?: boolean;
  public tags: ConnectionTags;

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
    this.role = props.role;
    this.endpoint = props.endpoint;
    this.alias = props.alias;
    this.autoAcceptConnection = props.autoAcceptConnection;
    this.tags = props.tags;
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
}
