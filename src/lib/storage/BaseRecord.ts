export enum RecordType {
  BaseRecord = 'BaseRecord',
  ConnectionRecord = 'ConnectionRecord',
  BasicMessageRecord = 'BasicMessageRecord',
  ProvisioningRecord = 'ProvisioningRecord',
}

export abstract class BaseRecord {
  createdAt: number;
  updatedAt?: number;
  id: string;
  tags: { [keys: string]: string };

  // Required because Javascript doesn't allow accessing static types
  // like instance.static_memeber
  type: RecordType = RecordType.BaseRecord;
  static type: RecordType = RecordType.BaseRecord;

  constructor(id: string) {
    this.id = id;
    this.createdAt = Date.now();
    this.tags = {};
  }

  getValue(): string {
    const { id, tags, ...value } = this;
    return JSON.stringify(value);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static fromPersistence<T>(typeClass: { new (...args: any[]): T }, props: {}): T {
    // eslint-disable-next-line
    // @ts-ignore
    const { value, ...rest } = props;

    return new typeClass({ ...JSON.parse(value), ...rest });
  }
}
