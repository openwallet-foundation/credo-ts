import uuid from 'uuid/v4';

export enum RecordTypes {
  BASE_RECORD = 'BaseRecord',
  CONNECTION_RECORD = 'ConnectionRecord',
  BASIC_MESSAGE_RECORD = 'BasicMessageRecord',
}

export abstract class BaseRecord {
  createdAt: number;
  updatedAt?: number;
  id: string;
  tags: { [keys: string]: string };

  // Required because Javascript doesn't allow accessing static types
  // like instance.static_memeber
  type: RecordTypes = RecordTypes.BASE_RECORD;
  static type: RecordTypes = RecordTypes.BASE_RECORD;

  constructor(id: string) {
    this.id = id;
    this.createdAt = new Date().getUTCMilliseconds();
    this.tags = {};
  }

  getValue(): string {
    const { id, tags, ...value } = this;
    return JSON.stringify(value);
  }

  static fromPersistence<T>(typeClass: { new (...args: any[]): T }, props: {}): T {
    // @ts-ignore
    const { value, ...rest } = props;

    return new typeClass({ ...JSON.parse(value), ...rest });
  }
}
