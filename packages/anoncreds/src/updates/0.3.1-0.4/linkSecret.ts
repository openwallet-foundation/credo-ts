import type { BaseAgent } from '@credo-ts/core'

import { AnonCredsLinkSecretRepository } from '../../repository'

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
    // NOTE: this migration is not relevant here, but kept for documentation purposes.
    // This migration was relevant if you were upgrading from 0.3 to 0.4 and kept using
    // the indy-sdk over askar. However since 0.5 there is no indy-sdk anymore, and thus
    // you MUST use Askar now, and the Askar migration already handles the link secret migration
    // and also actually sets the value. So there is no flow in which we would need this code.
    // If it would, the previous code would not store the value (only the link secret id) as we couldn't
    // access the value with Indy. So it wouldn't have been usable anyway

    // If no default link secret record exists, we create one based on the wallet id and set is as default
    agent.config.logger.error('No default link secret record found. This should not happen')
  } else {
    agent.config.logger.debug(
      `Default link secret record with record id ${defaultLinkSecret.id} and link secret id ${defaultLinkSecret.linkSecretId} found. Skipping...`
    )
  }

  agent.config.logger.debug('Successfully migrated link secret to version 0.4')
}
