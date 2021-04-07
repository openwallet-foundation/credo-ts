import type { Verkey } from 'indy-sdk';
import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from '../../../storage/BaseRecord';
import { MediationRole } from '../models/MediationRole';
import { MediationState } from '../models/MediationState';
import { Term } from '../models/Term';

export interface MediationRecordProps {
  id?: string;
  createdAt?: number;
  tags?: { [keys: string]: string };
  connectionId: string;
  endpoint?: string;
  routingKeys?: Verkey[];
  mediatorTerms: Term[];
  recipientTerms: Term[];
  state: MediationState;
  role: MediationRole;
}

export class MediationRecord extends BaseRecord {
  public connectionId: string;
  public endpoint: string;
  public routingKeys: Verkey[];
  public mediatorTerms: Term[];
  public recipientTerms: Term[];
  public state: MediationState;
  public role: MediationRole;

  public static readonly type: RecordType = RecordType.MediationRecord;
  public readonly type = MediationRecord.type;

  public constructor(props: MediationRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.connectionId = props.connectionId;
    this.endpoint = props.endpoint || '';
    this.routingKeys = props.routingKeys || [];
    this.mediatorTerms = props.mediatorTerms;
    this.recipientTerms = props.recipientTerms;
    this.state = props.state || MediationState.Init;
    this.role = props.role;
    this.tags = props.tags || {};
  }

  public assertState(expectedStates: MediationState | MediationState[]) {
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
