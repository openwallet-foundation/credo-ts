import type { AgentContext } from '@credo-ts/core'

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
