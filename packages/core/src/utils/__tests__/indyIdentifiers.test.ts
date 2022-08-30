import type { CredentialDefinitionTemplate } from '../../modules/ledger'
import type { SchemaTemplate } from '../../modules/ledger/services/IndyLedgerService'
import type { CredDef, Schema } from 'indy-sdk'

import {
  schemaToQualifiedIndySchemaTrunk,
  isQualifiedIndyIdentifier,
  getLegacyIndySchemaId,
  getLegacyIndyCredentialDefinitionId,
  getQualifiedIdentifierCredDef,
  getQualifiedIdentifierSchema,
  credDefToQualifiedIndyCredDefId,
} from '../indyIdentifiers'

const indyNamespace = 'some:staging'
const did = 'q7ATwTYbQDgiigVijUAej'
const qualifiedIdentifierSchema = `did:indy:${indyNamespace}:${did}/anoncreds/v0/SCHEMA/awesomeSchema/4.2.0`
const qualifiedIdentifierCredDef = `did:indy:${indyNamespace}:${did}/anoncreds/v0/CLAIM_DEF/99/sth`
const schemaId = `${did}:2:awesomeSchema:4.2.0`

const credentialDefinition = {
  schema: schemaId,
  tag: 'someTag',
  signatureType: 'CL',
  supportRevocation: true,
}

const schema: Schema = {
  id: schemaId,
  attrNames: ['hello', 'world'],
  name: 'awesomeSchema',
  version: '4.2.0',
  ver: '4.2.0',
  seqNo: 99,
}

const credDef: CredDef = {
  id: `${did}:3:CL:${schema.seqNo}:sth`,
  schemaId: schema.id,
  type: 'CL',
  tag: 'someTag',
  value: {
    primary: credentialDefinition as Record<string, unknown>,
    revocation: true,
  },
  ver: '1',
}

const credDefTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'> = {
  schema: schema,
  tag: 'someTag',
  supportRevocation: true,
}

const schemaTemplate: SchemaTemplate = {
  attributes: ['hello', 'world'],
  name: 'awesomeSchema',
  version: '4.2.0',
}

const schemaUrlTrunk = `${did}/anoncreds/v0/SCHEMA/awesomeSchema/4.2.0`
const credDefUrlTrunk = `${did}/anoncreds/v0/CLAIM_DEF/99/someTag`
const invalidCredDefUrlTrunk = `did:indy:${indyNamespace}:${did}/anoncreds/v0/I_AM_INVALID/99/sth`

describe('Mangle indy identifiers', () => {
  test('is a qualified identifier', async () => {
    expect(isQualifiedIndyIdentifier(qualifiedIdentifierSchema)).toBe(true)
  })

  test('is NOT a qualified identifier', async () => {
    expect(isQualifiedIndyIdentifier(did)).toBe(false)
  })

  describe('unqualify a qualified Indy did', () => {
    it('should successfully unqualify a qualified identifier for a schema', () => {
      expect(getLegacyIndySchemaId(qualifiedIdentifierSchema)).toBe(schemaId)
    })
    it('should return the unqualified identifier if it is passed to unqualify for a schema', () => {
      expect(getLegacyIndySchemaId(schemaId)).toBe(schemaId)
    })
    it('should successfully unqualify a qualified identifier for a credDef', () => {
      expect(getLegacyIndyCredentialDefinitionId(qualifiedIdentifierCredDef)).toBe(credDef.id)
    })
    it('should throw an error if the provided identifier is not a valid indy identifier', () => {
      expect(() => getLegacyIndyCredentialDefinitionId(credDef.id)).toThrowError(
        `Identifier ${credDef.id} not a qualified indy identifier. Hint: Needs to start with 'did:ind:'`
      )
    })
    it('should throw an error if the provided identifier has an invalid tail format', () => {
      expect(() => getLegacyIndyCredentialDefinitionId(invalidCredDefUrlTrunk)).toThrowError(
        `Provided identifier ${invalidCredDefUrlTrunk} has invalid format.`
      )
    })
  })

  test('get DID url trunk from schema', () => {
    expect(schemaToQualifiedIndySchemaTrunk(schemaTemplate, schemaId)).toBe(schemaUrlTrunk)
  })

  test('get DID url trunk from credential', () => {
    expect(credDefToQualifiedIndyCredDefId(credDef.id, credDefTemplate)).toBe(credDefUrlTrunk)
  })

  describe('getQualifiedIndyId', () => {
    it('should correctly create the Url trunk for a schema', () => {
      expect(schemaToQualifiedIndySchemaTrunk(schemaTemplate, schemaId)).toBe(schemaUrlTrunk)
    })
    it('should correctly create the Url trunk for a credential definition', () => {
      expect(credDefToQualifiedIndyCredDefId(credDef.id, credDefTemplate)).toBe(credDefUrlTrunk)
    })
  })
  describe('get the qualified identifier', () => {
    it('should return the qualified identifier if the identifier is already qualified', () => {
      const credDefWithQualifiedIdentifier = credDef
      credDefWithQualifiedIdentifier.id = qualifiedIdentifierCredDef
      expect(getQualifiedIdentifierCredDef(indyNamespace, qualifiedIdentifierCredDef, credDefTemplate)).toBe(
        qualifiedIdentifierCredDef
      )
    })
    it('should return the qualified identifier for a credential definition', () => {
      expect(getQualifiedIdentifierCredDef(indyNamespace, qualifiedIdentifierCredDef, credDefTemplate)).toBe(
        qualifiedIdentifierCredDef
      )
    })
    it('should return the qualified identifier for a schema', () => {
      expect(getQualifiedIdentifierSchema(indyNamespace, schemaTemplate, schemaId)).toBe(qualifiedIdentifierSchema)
    })
  })
})
