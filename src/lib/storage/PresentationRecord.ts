import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from './BaseRecord';
import { PresentationRequestMessage } from '../protocols/presentproof/messages/PresenationRequestMessage';
import { PresentationStates } from '../protocols/presentproof/PresentationStates';

export interface PresentationStorageProps {
    id?: string;
    createdAt?: number;
    presentationRequest: PresentationRequestMessage;
    state: PresentationStates;
    connectionId: string;
    presentationId?: PresentationId;
    tags: Record<string, unknown>;
}

// NEED TO REFACTOR THE STORED INFORMATION
export class PresentationRecord extends BaseRecord implements PresentationStorageProps {
    public connectionId: string;
    public presentationRequest: PresentationRequestMessage;
    public presentationId?: CredentialId;
    public type = RecordType.PresentationRecord;
    public static type: RecordType = RecordType.PresentationRecord;
    public state: PresentationStates;

    public constructor(props: PresentationStorageProps) {
        super(props.id ?? uuid(), props.createdAt ?? Date.now());
        this.presentationRequest = props.presentationRequest;
        this.state = props.state;
        this.connectionId = props.connectionId;
        this.presentationId = props.presentationId;
        this.tags = props.tags as { [keys: string]: string };
    }
}
