import { DateTransformer } from '@credo-ts/core'

export class RevocationNotification {
  @DateTransformer()
  public revocationDate: Date

  public comment?: string

  public constructor(comment?: string, revocationDate: Date = new Date()) {
    this.revocationDate = revocationDate
    this.comment = comment
  }
}
