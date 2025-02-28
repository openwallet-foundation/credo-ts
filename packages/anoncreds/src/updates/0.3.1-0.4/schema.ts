import type { BaseAgent } from '@credo-ts/core'
import type { AnonCredsSchema } from '../../models'

import { AnonCredsSchemaRepository } from '../../repository'

/**
 * Migrates the {@link AnonCredsSchemaRecord} to 0.4 compatible format. It fetches all schema records from
 * storage and updates the format based on the new ledger agnostic anoncreds models. After a record has been transformed,
 * it is updated in storage and the next record will be transformed.
 */
export async function migrateAnonCredsSchemaRecordToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating AnonCredsSchemaRecord records to storage version 0.4')
  const schemaRepository = agent.dependencyManager.resolve(AnonCredsSchemaRepository)

  agent.config.logger.debug('Fetching all schema records from storage')
  const schemaRecords = await schemaRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${schemaRecords.length} schema records to update.`)
  for (const schemaRecord of schemaRecords) {
    const oldSchema = schemaRecord.schema as unknown as OldSchema

    // If askar migration script is ran, it could be that the credential definition record is already in 0.4 format
    if (oldSchema.id === undefined) {
      agent.config.logger.info(
        `Schema record with id ${schemaRecord.id} and schema id ${schemaRecord.schemaId} is already in storage version 0.4 format. Probably due to Indy SDK to Askar migration. Skipping...`
      )
      continue
    }

    agent.config.logger.debug(
      `Migrating anoncreds schema record with id ${schemaRecord.id} and schema id ${oldSchema.id} to storage version 0.4`
    )

    const newSchema = {
      attrNames: oldSchema.attrNames,
      name: oldSchema.name,
      version: oldSchema.version,
      issuerId: oldSchema.id.split('/')[0],
    } satisfies AnonCredsSchema

    schemaRecord.schema = newSchema
    schemaRecord.schemaId = oldSchema.id
    schemaRecord.methodName = 'indy'

    // schemaIssuerDid was set as tag, but is now replaced by issuerId. It was also always set
    // to the value `did` as it incorrectly parsed the schemaId.
    schemaRecord.setTag('schemaIssuerDid', undefined)

    // Save updated schema record
    await schemaRepository.update(agent.context, schemaRecord)

    agent.config.logger.debug(`Successfully migrated schema record with id ${schemaRecord.id} to storage version 0.4`)
  }
}

export interface OldSchema {
  id: string
  name: string
  version: string
  attrNames: string[]
  seqNo: number
  ver: string
}
