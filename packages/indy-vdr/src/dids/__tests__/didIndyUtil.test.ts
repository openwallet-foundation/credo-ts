import { DidDocument, JsonTransformer } from '@aries-framework/core'

import { combineDidDocumentWithJson, didDocDiff } from '../didIndyUtil'

import didExample123Fixture from './__fixtures__/didExample123.json'
import didExample123Base from './__fixtures__/didExample123base.json'
import didExample123Extra from './__fixtures__/didExample123extracontent.json'

describe('didIndyUtil', () => {
  describe('combineDidDocumentWithJson', () => {
    it('should correctly combine a base DIDDoc with extra contents from a JSON object', async () => {
      const didDocument = JsonTransformer.fromJSON(didExample123Base, DidDocument)

      expect(combineDidDocumentWithJson(didDocument, didExample123Extra).toJSON()).toEqual(didExample123Fixture)
    })
  })

  describe('deepObjectDiff', () => {
    it('should correctly show the diff between a base DidDocument and a full DidDocument', async () => {
      expect(didDocDiff(didExample123Fixture, didExample123Base)).toMatchObject(didExample123Extra)
    })
  })
})
