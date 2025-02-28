import type { BaseAgent } from '@credo-ts/core'

import { AnonCredsLinkSecretRecord, AnonCredsLinkSecretRepository } from '../../repository'

/**
 * Creates an {@link AnonCredsLinkSecretRecord} based on the wallet id. If an {@link AnonCredsLinkSecretRecord}
 * already exists (which is the case when upgraded to Askar), no link secret record will be created.
 */
export async function migrateLinkSecretToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating link secret to storage version 0.4')

  const linkSecretRepository = agent.dependencyManager.resolve(AnonCredsLinkSecretRepository)

  agent.config.logger.debug('Fetching default link secret record from storage')
  const defaultLinkSecret = await linkSecretRepository.findDefault(agent.context)

  if (!defaultLinkSecret) {
    // If no default link secret record exists, we create one based on the wallet id and set is as default
    agent.config.logger.debug('No default link secret record found. Creating one based on wallet id.')

    if (!agent.wallet.walletConfig?.id) {
      agent.config.logger.error('Wallet id not found. Cannot create default link secret record. Skipping...')
      return
    }

    // We can't store the link secret value. This is not exposed by indy-sdk.
    const linkSecret = new AnonCredsLinkSecretRecord({
      linkSecretId: agent.wallet.walletConfig?.id,
    })
    linkSecret.setTag('isDefault', true)

    agent.config.logger.debug(
      `Saving default link secret record with record id ${linkSecret.id} and link secret id ${linkSecret.linkSecretId} to storage`
    )
    await linkSecretRepository.save(agent.context, linkSecret)
  } else {
    agent.config.logger.debug(
      `Default link secret record with record id ${defaultLinkSecret.id} and link secret id ${defaultLinkSecret.linkSecretId} found. Skipping...`
    )
  }

  agent.config.logger.debug('Successfully migrated link secret to version 0.4')
}
