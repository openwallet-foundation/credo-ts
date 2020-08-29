import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from './BaseRecord';

export interface BasicMessageStorageProps {
  id?: string;
  tags: { [keys: string]: string };

  content: string;
  sentTime: string;
}

export class BasicMessageRecord extends BaseRecord implements BasicMessageStorageProps {
  public content: string;
  public sentTime: string;

  public static readonly type: RecordType = RecordType.BasicMessageRecord;
  public readonly type = BasicMessageRecord.type;

  public constructor(props: BasicMessageStorageProps) {
    super(props.id || uuid());
    this.content = props.content;
    this.sentTime = props.sentTime;
    this.tags = props.tags;
  }
}
