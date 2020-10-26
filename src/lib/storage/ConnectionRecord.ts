import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType, Tags } from './BaseRecord';
import { DidDoc } from '../protocols/connections/domain/DidDoc';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';
import { ConnectionRole } from '../protocols/connections/domain/ConnectionRole';
import { JsonTransformer } from '../utils/JsonTransformer';

interface ConnectionProps {
  id?: string;
  createdAt?: number;
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
  private _invitation?: Record<string, unknown>;
  public state: ConnectionState;
  public role: ConnectionRole;
  public endpoint?: string;
  public alias?: string;
  public autoAcceptConnection?: boolean;
  public tags: ConnectionTags;

  public static readonly type: RecordType = RecordType.ConnectionRecord;
  public readonly type = ConnectionRecord.type;

  public constructor(props: ConnectionStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.did = props.did;
    this.didDoc = props.didDoc;
    this.verkey = props.verkey;
    this.theirDid = props.theirDid;
    this.theirDidDoc = props.theirDidDoc;
    this.state = props.state;
    this.role = props.role;
    this.endpoint = props.endpoint;
    this.alias = props.alias;
    this.autoAcceptConnection = props.autoAcceptConnection;
    this.tags = props.tags;
    this.invitation = props.invitation;

    // We need a better approach for this. After retrieving the connection message from
    // persistence it is plain json, so we need to transform it to a message class
    // if transform all record classes with class transformer this wouldn't be needed anymore
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _invitation = props._invitation;
    if (_invitation) {
      this._invitation = _invitation;
    }
  }

  public get invitation() {
    if (this._invitation) return JsonTransformer.fromJSON(this._invitation, ConnectionInvitationMessage);
  }

  public set invitation(invitation: ConnectionInvitationMessage | undefined) {
    if (invitation) this._invitation = JsonTransformer.toJSON(invitation);
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
