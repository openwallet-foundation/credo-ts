// @ts-ignore
import { wait } from 'await-poll';
import { EventEmitter } from 'events';
import { ConnectionState } from './ConnectionState';
import { DidDoc } from './DidDoc';
import { InvitationDetails } from './InvitationDetails';

export interface ConnectionProps {
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

interface DidExchangeConnection {
  DID: Did;
  DIDDoc: DidDoc;
}

export class Connection extends EventEmitter {
  id: string;
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirDidDoc?: DidDoc;
  invitation?: InvitationDetails;
  endpoint?: string;

  private state: ConnectionState;

  constructor(props: ConnectionProps) {
    super();
    this.id = props.id;
    this.did = props.did;
    this.didDoc = props.didDoc;
    this.verkey = props.verkey;
    this.theirDid = props.theirDid;
    this.theirDidDoc = props.theirDidDoc;
    this.invitation = props.invitation;
    this.state = props.state;
  }

  get theirKey() {
    if (!this.theirDidDoc) {
      return null;
    }
    return this.theirDidDoc.service[0].recipientKeys[0];
  }

  getState() {
    return this.state;
  }

  updateDidExchangeConnection(didExchangeConnection: DidExchangeConnection) {
    this.theirDid = didExchangeConnection.DID;
    this.theirDidDoc = didExchangeConnection.DIDDoc;
  }

  updateState(newState: ConnectionState) {
    this.state = newState;
    this.emit('change', newState);
  }

  async isConnected() {
    while (this.state !== ConnectionState.COMPLETE) {
      await wait(1000);
    }
    return true;
  }
}
