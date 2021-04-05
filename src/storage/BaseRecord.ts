export enum RecordType {
  BaseRecord = 'BaseRecord',
  ConnectionRecord = 'ConnectionRecord',
  BasicMessageRecord = 'BasicMessageRecord',
  ProvisioningRecord = 'ProvisioningRecord',
  CredentialRecord = 'CredentialRecord',
  ProofRecord = 'PresentationRecord',
  MediationRecord = 'MediationRecord',
}

export type Tags = Record<string, string | undefined>

export abstract class BaseRecord {
  public createdAt: number
  public updatedAt?: number
  public id: string
  public tags: Tags

  // Required because Javascript doesn't allow accessing static types
  // like instance.static_member
  public static readonly type: RecordType = RecordType.BaseRecord
  public readonly type = BaseRecord.type

  public constructor(id: string, createdAt: number) {
    this.id = id
    this.createdAt = createdAt
    this.tags = {}
  }

  public getValue(): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, tags, ...value } = this
    return JSON.stringify(value)
  }

  public static fromPersistence<T>(typeClass: { new (...args: unknown[]): T }, props: Record<string, any>): T {
    // eslint-disable-next-line
    // @ts-ignore
    const { value, ...rest } = props

    return new typeClass({ ...JSON.parse(value), ...rest })
  }
}
