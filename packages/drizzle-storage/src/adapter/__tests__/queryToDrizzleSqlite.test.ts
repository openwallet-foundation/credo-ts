import { MdocRecord } from '@credo-ts/core'
import { ConnectionRecord } from '@credo-ts/didcomm'
import { mdoc } from '../../core/mdoc/sqlite'
import { createDrizzle } from '../../createDrizzle'
import { didcommConnection } from '../../didcomm/connection/sqlite'
import { DrizzleSqliteDatabase } from '../../sqlite'
import { queryToDrizzleSqlite } from '../queryToDrizzleSqlite'

const db = createDrizzle({
  schema: {
    mdoc,
  },
  databaseUrl: ':memory:',
  type: 'sqlite',
}) as DrizzleSqliteDatabase<{ mdoc: typeof mdoc }>

describe('queryToDrizzle', () => {
  test('should transform simple query', () => {
    expect(
      db
        .select()
        .from(mdoc)
        .where(
          queryToDrizzleSqlite<MdocRecord>(
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
      sql: 'select "id", "created_at", "updated_at", "metadata", "custom_tags", "base64_url", "alg", "doc_type" from "Mdoc" where ("Mdoc"."alg" = ? and "Mdoc"."doc_type" = ? and JSON_EXTRACT("Mdoc"."custom_tags", ?) = ?)',
      params: ['ES256', 'something', '$."customTag"', 'hey'],
    })
  })

  test('should transform query with array values', () => {
    expect(
      db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzleSqlite<ConnectionRecord>(
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
      sql: `select \"id\", \"created_at\", \"updated_at\", \"metadata\", \"custom_tags\", \"state\", \"role\", \"did\", \"their_did\", \"their_label\", \"alias\", \"auto_accept_connection\", \"image_url\", \"thread_id\", \"invitation_did\", \"mediator_id\", \"out_of_band_id\", \"error_message\", \"protocol\", \"connection_types\", \"previous_dids\", \"previous_their_dids\" from \"DidcommConnection\" where (EXISTS (SELECT 1 FROM JSON_EACH(\"DidcommConnection\".\"connection_types\") WHERE JSON_EACH.value = JSON(?)) AND EXISTS (SELECT 1 FROM JSON_EACH(\"DidcommConnection\".\"connection_types\") WHERE JSON_EACH.value = JSON(?)) and EXISTS (
      SELECT 1 
      FROM JSON_EACH(JSON_EXTRACT(\"DidcommConnection\".\"custom_tags\", ?)) 
      WHERE JSON_EACH.value = JSON(?)
    ) AND EXISTS (
      SELECT 1 
      FROM JSON_EACH(JSON_EXTRACT(\"DidcommConnection\".\"custom_tags\", ?)) 
      WHERE JSON_EACH.value = JSON(?)
    ) and \"DidcommConnection\".\"invitation_did\" = ?)`,
      params: ['"one"', '"two"', '$."myCustomTag"', '"First"', '$."myCustomTag"', '"Second"', 'some string'],
    })
  })

  test('should transform query with and/or statements', () => {
    expect(
      db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzleSqlite<ConnectionRecord>(
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
          queryToDrizzleSqlite<ConnectionRecord>(
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
