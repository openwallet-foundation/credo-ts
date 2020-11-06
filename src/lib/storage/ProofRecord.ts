import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from './BaseRecord';
import { PresentationRequestMessage } from '../protocols/presentproof/messages/PresenationRequestMessage';
import { ProofStates } from '../protocols/presentproof/ProofStates';

export interface ProofStorageProps {
  id?: string;
  createdAt?: number;
  presentationRequest: PresentationRequestMessage;
  state: ProofStates;
  connectionId: string;
  presentationId?: PresentationId;
  tags: Record<string, unknown>;
}

// NEED TO REFACTOR THE STORED INFORMATION
export class ProofRecord extends BaseRecord implements ProofStorageProps {
  public connectionId: string;
  public presentationRequest: PresentationRequestMessage;
  public presentationId?: CredentialId;
  public type = RecordType.PresentationRecord;
  public static type: RecordType = RecordType.PresentationRecord;
  public state: ProofStates;

  public constructor(props: ProofStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.presentationRequest = props.presentationRequest;
    this.state = props.state;
    this.connectionId = props.connectionId;
    this.presentationId = props.presentationId;
    this.tags = props.tags as { [keys: string]: string };
  }
}
