import type { AgentContext } from '@credo-ts/core'

import { AnonCredsRsError } from '../error/AnonCredsRsError'
import { AnonCredsLinkSecretRecord, AnonCredsLinkSecretRepository } from '../repository'

export async function storeLinkSecret(
  agentContext: AgentContext,
  options: { linkSecretId: string; linkSecretValue?: string; setAsDefault?: boolean }
) {
  const { linkSecretId, linkSecretValue, setAsDefault } = options
  const linkSecretRepository = agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository)

  // In some cases we don't have the linkSecretValue. However we still want a record so we know which link secret ids are valid
  const linkSecretRecord = new AnonCredsLinkSecretRecord({ linkSecretId, value: linkSecretValue })

  // If it is the first link secret registered, set as default
  const defaultLinkSecretRecord = await linkSecretRepository.findDefault(agentContext)
  if (!defaultLinkSecretRecord || setAsDefault) {
    linkSecretRecord.setTag('isDefault', true)
  }

  // Set the current default link secret as not default
  if (defaultLinkSecretRecord && setAsDefault) {
    defaultLinkSecretRecord.setTag('isDefault', false)
    await linkSecretRepository.update(agentContext, defaultLinkSecretRecord)
  }

  await linkSecretRepository.save(agentContext, linkSecretRecord)

  return linkSecretRecord
}

export function assertLinkSecretsMatch(_agentContext: AgentContext, linkSecretIds: string[]) {
  // Get all requested credentials and take linkSecret. If it's not the same for every credential, throw error
  const linkSecretsMatch = linkSecretIds.every((linkSecretId) => linkSecretId === linkSecretIds[0])
  if (!linkSecretsMatch) {
    throw new AnonCredsRsError('All credentials in a Proof should have been issued using the same Link Secret')
  }

  return linkSecretIds[0]
}

export async function getLinkSecret(agentContext: AgentContext, linkSecretId: string): Promise<string> {
  const linkSecretRecord = await agentContext.dependencyManager
    .resolve(AnonCredsLinkSecretRepository)
    .getByLinkSecretId(agentContext, linkSecretId)

  if (!linkSecretRecord.value) {
    throw new AnonCredsRsError('Link Secret value not stored')
  }

  return linkSecretRecord.value
}
