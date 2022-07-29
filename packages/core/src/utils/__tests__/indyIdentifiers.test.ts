import type { CredDef, Schema } from 'indy-sdk'

import {
  getQualifiedIdentifier,
  getDidUrlTrunkFromSchema,
  isQualifiedIdentifier,
  unqualifyIndyDid,
  getDidUrlTrunkFromCredDef,
  getDidUrlTrunk,
} from '../indyIdentifiers'

const indyNamespace = 'some:staging'
const did = 'q7ATwTYbQDgiigVijUAej'
const qualifiedIdentifierSchema = `did:indy:${indyNamespace}:${did}/anoncreds/v0/SCHEMA/awesomeSchema/4.2.0`
const qualifiedIdentifierCredDef = `did:indy:${indyNamespace}:${did}/anoncreds/v0/CLAIM_DEF/awesomeCredDef/sth`
const schemaId = `${did}:2:awesomeSchema:4.2.0`

const schema: Schema = {
  id: schemaId,
  attrNames: ['hello', 'world'],
  name: 'awesomeSchema',
  version: '4.2.0',
  ver: '4.2.0',
  seqNo: 99,
}

const credentialDefinition = {
  schema: 'abcde',
  tag: 'someTag',
  signatureType: 'CL',
  supportRevocation: true,
}

const credDef: CredDef = {
  id: 'abcde',
  schemaId: schema.id,
  type: 'CL',
  tag: 'someTag',
  value: {
    primary: credentialDefinition as Record<string, unknown>,
    revocation: true,
  },
  ver: '1',
}

const schemaUrlTrunk = 'q7ATwTYbQDgiigVijUAej/anoncreds/v0/SCHEMA/awesomeSchema/4.2.0'
const credDefUrlTrunk = 'abcde/anoncreds/v0/CLAIM_DEF/99/someTag'
describe('Mangle indy identifiers', () => {
  test('is a qualified identifier', async () => {
    expect(isQualifiedIdentifier(qualifiedIdentifierSchema)).toBe(true)
  })

  test('is NOT a qualified identifier', async () => {
    expect(isQualifiedIdentifier(did)).toBe(false)
  })

  describe('unqualify a qualified Indy did', () => {
    it('should successfully unqualify a qualified identifier', () => {
      expect(unqualifyIndyDid(qualifiedIdentifierSchema)).toBe(schemaId)
    })
    it('should return the unqualified identifier if it is passed to unqualify', () => {
      expect(unqualifyIndyDid(schemaId)).toBe(schemaId)
    })
  })

  test('get DID url trunk from schema', () => {
    expect(getDidUrlTrunkFromSchema(schema)).toBe(schemaUrlTrunk)
  })

  test('get DID url trunk from credential', () => {
    expect(getDidUrlTrunkFromCredDef({ ...credDef, schemaSeqNo: schema.seqNo })).toBe(credDefUrlTrunk)
  })

  describe('getDidUrlTrunk', () => {
    it('should correctly create the Url trunk for a schema', () => {
      expect(getDidUrlTrunk(schema)).toBe(schemaUrlTrunk)
    })
    it('should correctly create the Url trunk for a credential definition', () => {
      expect(getDidUrlTrunk({ ...credDef, schemaSeqNo: schema.seqNo })).toBe(credDefUrlTrunk)
    })
  })
  describe('get the qualified identifier', () => {
    it('should return the qualified identifier if the identifier is already qualified', () => {
      const credDefWithQualifiedIdentifier = credDef
      credDefWithQualifiedIdentifier.id = qualifiedIdentifierCredDef
      expect(
        getQualifiedIdentifier(indyNamespace, { ...credDefWithQualifiedIdentifier, schemaSeqNo: schema.seqNo })
      ).toBe(qualifiedIdentifierCredDef)
    })
    it('should return the qualified identifier for a credential definition', () => {
      expect(getQualifiedIdentifier(indyNamespace, { ...credDef, schemaSeqNo: schema.seqNo })).toBe(
        qualifiedIdentifierCredDef
      )
    })
    it('should return the qualified identifier for a schema', () => {
      expect(getQualifiedIdentifier(indyNamespace, schema)).toBe(qualifiedIdentifierSchema)
    })
  })
})
