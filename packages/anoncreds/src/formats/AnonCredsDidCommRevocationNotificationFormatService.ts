import type { AgentContext, Query } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord, DidCommRevocationNotificationFormatService } from '@credo-ts/didcomm'
import { DidCommCredentialExchangeRepository, DidCommCredentialRole } from '@credo-ts/didcomm'

const indyAnoncredsFormat = 'indy-anoncreds'
const anoncredsFormat = 'anoncreds'

const indyCredentialIdRegex =
  /((?:[\dA-z]{21,22}):4:(?:[\dA-z]{21,22}):3:[Cc][Ll]:(?:(?:[1-9][0-9]*)|(?:[\dA-z]{21,22}:2:.+:[0-9.]+)):.+?:CL_ACCUM:(?:[\dA-z-]+))::(\d+)$/
const anoncredsCredentialIdRegex = /([a-zA-Z0-9+\-.]+:.+)::(\d+)$/

export class AnonCredsDidCommRevocationNotificationFormatService implements DidCommRevocationNotificationFormatService {
  public readonly supportedRevocationFormats = [indyAnoncredsFormat, anoncredsFormat] as const

  public async findCredentialExchangeRecord(
    agentContext: AgentContext,
    credentialId: string,
    revocationFormat: string,
    connectionId?: string
  ): Promise<DidCommCredentialExchangeRecord> {
    const regex = this.getCredentialIdRegex(revocationFormat)
    if (!regex) {
      throw new CredoError(`Unsupported AnonCreds revocation format '${revocationFormat}'`)
    }

    const groups = credentialId.match(regex)
    if (!groups) {
      throw new CredoError(`Invalid ${revocationFormat} revocation credential id '${credentialId}'`)
    }

    const [, revocationRegistryId, credentialRevocationId] = groups
    const query: Query<DidCommCredentialExchangeRecord> = {
      anonCredsRevocationRegistryId: revocationRegistryId,
      anonCredsCredentialRevocationId: credentialRevocationId,
      role: DidCommCredentialRole.Holder,
      ...(connectionId && { connectionId }),
    }

    return agentContext.dependencyManager
      .resolve(DidCommCredentialExchangeRepository)
      .getSingleByQuery(agentContext, query)
  }

  public async getCredentialId(
    _agentContext: AgentContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    revocationFormat: string
  ): Promise<string> {
    const regex = this.getCredentialIdRegex(revocationFormat)
    if (!regex) {
      throw new CredoError(`Unsupported AnonCreds revocation format '${revocationFormat}'`)
    }

    const revocationRegistryId = credentialExchangeRecord.getTag('anonCredsRevocationRegistryId')
    const credentialRevocationId = credentialExchangeRecord.getTag('anonCredsCredentialRevocationId')
    if (typeof revocationRegistryId !== 'string' || typeof credentialRevocationId !== 'string') {
      throw new CredoError(
        `Credential exchange record '${credentialExchangeRecord.id}' does not contain AnonCreds revocation identifiers`
      )
    }

    const credentialId = `${revocationRegistryId}::${credentialRevocationId}`
    if (!regex.test(credentialId)) {
      throw new CredoError(
        `Credential exchange record '${credentialExchangeRecord.id}' does not match AnonCreds revocation format '${revocationFormat}'`
      )
    }

    return credentialId
  }

  private getCredentialIdRegex(revocationFormat: string): RegExp | undefined {
    if (revocationFormat === indyAnoncredsFormat) return indyCredentialIdRegex
    if (revocationFormat === anoncredsFormat) return anoncredsCredentialIdRegex
    return undefined
  }
}
