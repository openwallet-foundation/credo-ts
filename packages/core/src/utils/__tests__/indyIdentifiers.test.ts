import {
  isQualifiedIndyIdentifier,
  getQualifiedIndyCredentialDefinitionId,
  getQualifiedIndySchemaId,
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
} from '../indyIdentifiers'

const indyNamespace = 'some:staging'
const did = 'q7ATwTYbQDgiigVijUAej'
const qualifiedSchemaId = `did:indy:${indyNamespace}:${did}/anoncreds/v0/SCHEMA/awesomeSchema/4.2.0`
const qualifiedCredentialDefinitionId = `did:indy:${indyNamespace}:${did}/anoncreds/v0/CLAIM_DEF/99/sth`
const unqualifiedSchemaId = `${did}:2:awesomeSchema:4.2.0`
const unqualifiedCredentialDefinitionId = `${did}:3:CL:99:sth`

describe('Mangle indy identifiers', () => {
  test('is a qualified identifier', async () => {
    expect(isQualifiedIndyIdentifier(qualifiedSchemaId)).toBe(true)
  })

  test('is NOT a qualified identifier', async () => {
    expect(isQualifiedIndyIdentifier(did)).toBe(false)
  })

  describe('get the qualified identifier', () => {
    it('should return the qualified identifier if the identifier is already qualified', () => {
      expect(getQualifiedIndyCredentialDefinitionId(indyNamespace, qualifiedCredentialDefinitionId)).toBe(
        qualifiedCredentialDefinitionId
      )
    })

    it('should return the qualified identifier for a credential definition', () => {
      expect(getQualifiedIndyCredentialDefinitionId(indyNamespace, unqualifiedCredentialDefinitionId)).toBe(
        qualifiedCredentialDefinitionId
      )
    })

    it('should return the qualified identifier for a schema', () => {
      expect(getQualifiedIndySchemaId(indyNamespace, qualifiedSchemaId)).toBe(qualifiedSchemaId)
    })

    it('should return the qualified identifier for a schema', () => {
      expect(getQualifiedIndySchemaId(indyNamespace, unqualifiedSchemaId)).toBe(qualifiedSchemaId)
    })
  })

  // generateSchemaId
  it('Should return a valid schema ID given did name and version', () => {
    const did = '12345',
      name = 'backbench',
      version = '420'
    expect(getLegacySchemaId(did, name, version)).toEqual('12345:2:backbench:420')
  })

  // generateCredentialDefinitionId
  it('Should return a valid schema ID given did name and version', () => {
    const did = '12345',
      seqNo = 420,
      tag = 'someTag'
    expect(getLegacyCredentialDefinitionId(did, seqNo, tag)).toEqual('12345:3:CL:420:someTag')
  })
})
