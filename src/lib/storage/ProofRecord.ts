import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from './BaseRecord';
import { RequestPresentationMessage } from '../protocols/proof/messages/RequestPresentationMessage';
import { ProofState } from '../protocols/proof/ProofState';

export interface ProofStorageProps {
  id?: string;
  createdAt?: number;
  presentationRequest: RequestPresentationMessage;
  state: ProofState;
  connectionId: string;
  presentationId?: string;
  tags: Record<string, unknown>;
}

//TODO :  Draft version -> need storage changes
export class ProofRecord extends BaseRecord implements ProofStorageProps {
  public connectionId: string;
  public presentationRequest: RequestPresentationMessage;
  public presentationId?: string;
  public type = RecordType.ProofRecord;
  public static type: RecordType = RecordType.ProofRecord;
  public state: ProofState;

  public constructor(props: ProofStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.presentationRequest = props.presentationRequest;
    this.state = props.state;
    this.connectionId = props.connectionId;
    this.presentationId = props.presentationId;
    this.tags = props.tags as { [keys: string]: string };
  }
}
