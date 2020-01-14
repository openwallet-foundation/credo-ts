import EventEmitter from 'events';
import { ConnectionState } from './ConnectionState';
import { DidDoc } from './DidDoc';
import { InvitationDetails } from './InvitationDetails';

interface ConnectionProps {
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirKey?: Verkey;
  theirDidDoc?: any;
  invitation?: InvitationDetails;
  state: ConnectionState;
  endpoint?: string;
  messages: any[];
}

export class Connection extends EventEmitter {
  did: Did;
  didDoc: DidDoc;
  verkey: Verkey;
  theirDid?: Did;
  theirKey?: Verkey;
  theirDidDoc?: any;
  invitation?: InvitationDetails;
  endpoint?: string;
  messages: any[];

  private state: ConnectionState;

  constructor(props: ConnectionProps) {
    super();
    this.did = props.did;
    this.didDoc = props.didDoc;
    this.verkey = props.verkey;
    this.state = props.state;
    this.messages = props.messages;
  }

  getState() {
    return this.state;
  }

  updateState(newState: ConnectionState) {
    this.state = newState;
    this.emit('change', newState);
  }

  async isConnected() {
    return new Promise(resolve => {
      if (this.getState() == 4) {
        resolve(true);
      }
      this.on('change', (newState: number) => {
        if (newState === 4) {
          resolve(true);
        }
      });
    });
  }
}
