import type { AnonCredsSchema } from './models/registry'

// FIXME: we should update the name in the AnonCreds registry interface to include extra wording in the name to prevent name clashes.
export interface RegisterSchemaApiOptions {
  schema: AnonCredsSchema

  // Identifier of the identifier that will create the schema. In most cases a did, but can also be an URI.
  //   TODO: do we want an issuerId? Or should we add such properties to an options object that is different per method
  // more like the did registration interface?
  issuerId: string
}

export interface RegisterSchemaApiReturn {
  schemaId: string
  schema: AnonCredsSchema
}
