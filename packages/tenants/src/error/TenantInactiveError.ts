import { CredoError } from '@credo-ts/core'

export class TenantInactiveError extends CredoError {
  public tenantId: string

  public constructor(tenantId: string) {
    super(`Tenant '${tenantId}' is inactive. Sessions can not be opened for inactive tenants.`)
    this.tenantId = tenantId
  }
}
