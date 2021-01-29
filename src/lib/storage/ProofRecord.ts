import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType, Tags } from './BaseRecord';
import { ProofState, PresentationPreview } from '../protocols/present-proof';
import { ProofRequest } from '../protocols/present-proof/models/ProofRequest';

export interface ProofRecordProps {
  id?: string;
  createdAt?: number;

  isVerified?: boolean;
  state: ProofState;
  connectionId: string;
  presentationId?: string;
  tags: ProofRecordTags;

  // message data
  proposal?: PresentationPreview;
  request?: ProofRequest;
  proof?: IndyProof;
}
export interface ProofRecordTags extends Tags {
  threadId?: string;
}

export class ProofRecord extends BaseRecord implements ProofRecordProps {
  public connectionId: string;
  public isVerified?: boolean;
  public presentationId?: string;
  public state: ProofState;
  public tags: ProofRecordTags;

  // message data
  public proposal?: PresentationPreview;
  public request?: ProofRequest;
  public proof?: IndyProof;

  public static readonly type: RecordType = RecordType.ProofRecord;
  public readonly type = RecordType.ProofRecord;

  public constructor(props: ProofRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.request = props.request;
    this.proposal = props.proposal;
    this.proof = props.proof;
    this.isVerified = props.isVerified;
    this.state = props.state;
    this.connectionId = props.connectionId;
    this.presentationId = props.presentationId;
    this.tags = props.tags as { [keys: string]: string };
  }

  public assertState(expectedStates: ProofState | ProofState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates];
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(
        `Proof record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      );
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (this.connectionId !== currentConnectionId) {
      throw new Error(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      );
    }
  }
}
