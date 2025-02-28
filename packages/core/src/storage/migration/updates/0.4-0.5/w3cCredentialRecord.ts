import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { W3cCredentialRecord } from '../../../../modules/vc/repository'

import { W3cJsonLdVerifiableCredential } from '../../../../modules/vc'
import { W3cJsonLdCredentialService } from '../../../../modules/vc/data-integrity/W3cJsonLdCredentialService'
import { W3cCredentialRepository } from '../../../../modules/vc/repository'

/**
 * Re-saves the w3c credential records to add the new 'types' tag.
 */
export async function migrateW3cCredentialRecordToV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migration w3c credential records records to storage version 0.5')

  const w3cCredentialRepository = agent.dependencyManager.resolve(W3cCredentialRepository)

  agent.config.logger.debug('Fetching all w3c credential records from storage')
  const records = await w3cCredentialRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${records.length} w3c credential records to update.`)

  for (const record of records) {
    agent.config.logger.debug(
      `Updating w3c credential record with id ${record.id} to add 'types' tag and fix 'expandedTypes' tag for storage version 0.5`
    )

    await fixIncorrectExpandedTypesWithAskarStorage(agent, record)

    // Save updated record
    await w3cCredentialRepository.update(agent.context, record)

    agent.config.logger.debug(`Successfully migrated w3c credential record with id ${record.id} to storage version 0.5`)
  }
}

/**
 * Up until 0.5.0 the AskarStorageService contained a bug where a non-computed (so manually set on record) array tag values that contained a : in the value
 * would be incorrectly parsed back from an askar tag to a tag on a record. This would only cause problems for the storage if the record was re-saved and not
 * computed. The following would happen:
 * - Create record with non-computed tag, e.g. expandedTypes that contains a value with a : in it
 * - Save record. The tag is correctly set in Askar as `expandedTypes:https://example.com'
 * - Read record. The tag is correctly read from Askar as `expandedTypes:https://example.com'. However the transformation would result in the tag value on the record being set to `https'.
 * - Save record. The non-computed (important, as otherwise the correct computed value would overwrite the incorrect value before storing) tag value is now set to `https' instead of `https://example.com'
 *
 * This function checks if any of the values for expandedTypes is `https` and if so, re-calculates the correct value and sets it on the record.
 *
 * NOTE: This function needs to resolve the context of a W3cCredentialRecord to be able to correctly calculate the expanded types.
 * To not brick a wallet that has no internet when updating, the storage update will allow the resolving of the expanded types to fail.
 * If this is the case, at a later point the expanded types will need to be recalculated and set on the record.
 *
 * If w3c credential records are never re-saved this shouldn't be a problem though. By default w3c credential records are not re-saved,
 * and so it only applies if you have implemented a custom flow that re-saves w3c credential records (e.g. if you add metadata).
 */
export async function fixIncorrectExpandedTypesWithAskarStorage<Agent extends BaseAgent>(
  agent: Agent,
  w3cCredentialRecord: W3cCredentialRecord
) {
  // We don't store the expanded types for JWT credentials (should we? As you can have jwt_vc with json-ld)
  if (!(w3cCredentialRecord.credential instanceof W3cJsonLdVerifiableCredential)) return

  const expandedTypes = (w3cCredentialRecord.getTag('expandedTypes') ?? []) as string[]

  // Check if one of the values is `https`
  const hasInvalidType = expandedTypes.some((type) => type === 'https')

  if (!hasInvalidType) return

  agent.context.config.logger.info(
    `W3c credential record with id '${w3cCredentialRecord.id}' contains invalid expanded types. Recalculating...`
  )
  const w3cJsonLdCredentialService = agent.dependencyManager.resolve(W3cJsonLdCredentialService)

  try {
    // JsonLd credentials need expanded types to be stored.
    const newExpandedTypes = await w3cJsonLdCredentialService.getExpandedTypesForCredential(
      agent.context,
      w3cCredentialRecord.credential
    )

    w3cCredentialRecord.setTag('expandedTypes', newExpandedTypes)
    agent.context.config.logger.info(
      `Successfully recalculated expanded types for w3c credential record with id ${w3cCredentialRecord.id} to ${newExpandedTypes} and set it on the record.`
    )
  } catch (_error) {
    agent.context.config.logger.error(
      `Retrieving expandedTypes fro w3c credential record with id ${w3cCredentialRecord.id} failed. To not brick the wallet, the storage update will not fail. Make sure to recalculate the expanded types at a later point. This is probably due to a missing internet connection. See https://credo.js.org/guides/updating/versions/0.4-to-0.5 for more information.`
    )
  }
}
