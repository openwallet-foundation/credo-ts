import type { DIDDocument } from '@cheqd/sdk'

import { DidDocument } from '@credo-ts/core'

import {
  createMsgCreateDidDocPayloadToSign,
  createMsgDeactivateDidDocPayloadToSign,
  validateSpecCompliantPayload,
} from '../src/dids/didCheqdUtil'

import { validDid, validDidDoc } from './setup'

describe('Test Cheqd Did Utils', () => {
  it('should validate did spec compliant payload', () => {
    const didDoc = validDidDoc()
    const result = validateSpecCompliantPayload(didDoc)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should detect invalid verification method', () => {
    const result = validateSpecCompliantPayload(
      new DidDocument({
        id: validDid,
        verificationMethod: [
          {
            id: `${validDid}#key-1`,
            publicKeyBase58: 'asca12e3as',
            type: 'JsonWebKey2020',
            controller: validDid,
          },
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should create MsgCreateDidDocPayloadToSign', async () => {
    const result = await createMsgCreateDidDocPayloadToSign(validDidDoc().toJSON() as DIDDocument, '1.0')
    expect(result).toBeDefined()
  })

  it('should create MsgDeactivateDidDocPayloadToSign', async () => {
    const result = createMsgDeactivateDidDocPayloadToSign({ id: validDid }, '2.0')
    expect(result).toBeDefined()
  })
})
