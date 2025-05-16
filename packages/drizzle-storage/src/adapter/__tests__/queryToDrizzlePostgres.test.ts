import { MdocRecord } from '@credo-ts/core'
import { ConnectionRecord } from '@credo-ts/didcomm'
import { mdoc } from '../../core/mdoc/postgres'
import { createDrizzle } from '../../createDrizzle'
import { didcommConnection } from '../../didcomm/connection/postgres'
import { DrizzlePostgresDatabase } from '../../postgres'
import { queryToDrizzlePostgres } from '../queryToDrizzlePostgres'

const db = createDrizzle({
  schema: {
    mdoc,
  },
  databaseUrl: '',
  type: 'postgres',
}) as DrizzlePostgresDatabase<{ mdoc: typeof mdoc }>

describe('queryToDrizzle', () => {
  test('should transform simple query', () => {
    expect(
      db
        .select()
        .from(mdoc)
        .where(
          queryToDrizzlePostgres<MdocRecord>(
            {
              alg: 'ES256',
              docType: 'something',
              customTag: 'hey',
            },
            mdoc
          )
        )
        .toSQL()
    ).toEqual({
      sql: `select "id", "created_at", "updated_at", "metadata", "custom_tags", "base64_url", "alg", "doc_type" from "Mdoc" where ("Mdoc"."alg" = $1 and "Mdoc"."doc_type" = $2 and "Mdoc"."custom_tags"->>'$3' = $4)`,
      params: ['ES256', 'something', 'customTag', 'hey'],
    })
  })

  test('should transform query with array values', () => {
    expect(
      db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one', 'two'],
              myCustomTag: ['First', 'Second'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
        .toSQL()
    ).toEqual({
      sql: 'select "id", "created_at", "updated_at", "metadata", "custom_tags", "state", "role", "did", "their_did", "their_label", "alias", "auto_accept_connection", "image_url", "thread_id", "invitation_did", "mediator_id", "out_of_band_id", "error_message", "protocol", "connection_types", "previous_dids", "previous_their_dids" from "DidcommConnection" where ("DidcommConnection"."connection_types" @> array[$1, $2] and "DidcommConnection"."custom_tags"->\'$3\' @> \'["First"]\'::jsonb AND "DidcommConnection"."custom_tags"->\'$4\' @> \'["Second"]\'::jsonb and "DidcommConnection"."invitation_did" = $5)',
      params: ['one', 'two', 'myCustomTag', 'myCustomTag', 'some string'],
    })
  })

  test('should transform query with and/or statements', () => {
    expect(
      db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one', 'two'],
              $or: [
                {
                  connectionTypes: ['three', 'four'],
                },
                {
                  connectionTypes: ['eight', 'nine'],
                },
              ],
              $and: [
                {
                  connectionTypes: ['five', 'six'],
                },
              ],
            },
            didcommConnection
          )
        )
        .toSQL()
    ).toEqual({
      sql: 'select "id", "created_at", "updated_at", "metadata", "custom_tags", "state", "role", "did", "their_did", "their_label", "alias", "auto_accept_connection", "image_url", "thread_id", "invitation_did", "mediator_id", "out_of_band_id", "error_message", "protocol", "connection_types", "previous_dids", "previous_their_dids" from "DidcommConnection" where (("DidcommConnection"."connection_types" @> array[$1, $2] or "DidcommConnection"."connection_types" @> array[$3, $4]) and "DidcommConnection"."connection_types" @> array[$5, $6] and "DidcommConnection"."connection_types" @> array[$7, $8])',
      params: ['three', 'four', 'eight', 'nine', 'five', 'six', 'one', 'two'],
    })
  })

  test('should transform query with not statements', () => {
    expect(
      db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['connection-one', 'connection-two'],
              $not: {
                $and: [
                  {
                    mediatorId: 'mediator-1',
                  },
                  {
                    mediatorId: 'mediator-2',
                  },
                ],
                $or: [
                  {
                    did: 'one',
                  },
                  {
                    did: 'two',
                  },
                ],
              },
            },
            didcommConnection
          )
        )
        .toSQL()
    ).toEqual({
      sql: 'select "id", "created_at", "updated_at", "metadata", "custom_tags", "state", "role", "did", "their_did", "their_label", "alias", "auto_accept_connection", "image_url", "thread_id", "invitation_did", "mediator_id", "out_of_band_id", "error_message", "protocol", "connection_types", "previous_dids", "previous_their_dids" from "DidcommConnection" where (not (("DidcommConnection"."did" = $1 or "DidcommConnection"."did" = $2) and ("DidcommConnection"."mediator_id" = $3 and "DidcommConnection"."mediator_id" = $4)) and "DidcommConnection"."connection_types" @> array[$5, $6])',
      params: ['one', 'two', 'mediator-1', 'mediator-2', 'connection-one', 'connection-two'],
    })
  })
})
