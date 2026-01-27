import { OutOfBandDidCommService } from '../../../../../../../didcomm/src/modules/oob'
import { outOfBandServiceToNumAlgo4Did } from '../../../../../../../didcomm/src/modules/oob/converters'
import { JsonTransformer } from '../../../../../utils'
import { DidDocument } from '../../../domain'
import { didDocumentToNumAlgo4Did, didToNumAlgo4DidDocument } from '../peerDidNumAlgo4'
import didPeer4zQmd8Cp from './__fixtures__/didPeer4zQmd8Cp.json'
import didPeer4zQmUJdJ from './__fixtures__/didPeer4zQmUJdJ.json'

describe('peerDidNumAlgo4', () => {
  describe('didToNumAlgo4DidDocument', () => {
    test('transforms method 4 peer did to a did document', async () => {
      expect(didToNumAlgo4DidDocument(didPeer4zQmd8Cp.id).toJSON()).toMatchObject(didPeer4zQmd8Cp)
    })
  })

  describe('didDocumentToNumAlgo4Did', () => {
    test('transforms method 4 peer did document to a did', async () => {
      const longFormDid = didPeer4zQmUJdJ.id
      const shortFormDid = didPeer4zQmUJdJ.alsoKnownAs[0]

      const didDocument = JsonTransformer.fromJSON(didPeer4zQmUJdJ, DidDocument)

      expect(didDocumentToNumAlgo4Did(didDocument)).toEqual({ longFormDid, shortFormDid })
    })
  })

  describe('outOfBandServiceToNumAlgo4Did', () => {
    test('transforms a did comm service into a valid method 4 did', () => {
      const service = new OutOfBandDidCommService({
        id: '#service-0',
        serviceEndpoint: 'https://example.com/endpoint',
        recipientKeys: ['did:key:z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'],
        routingKeys: ['did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'],
        accept: ['didcomm/v2', 'didcomm/aip2;env=rfc587'],
      })
      const { longFormDid } = outOfBandServiceToNumAlgo4Did(service)
      const peerDidDocument = didToNumAlgo4DidDocument(longFormDid)

      expect(longFormDid).toBe(
        'did:peer:4zQmUgFc9wpM9XnHRwUMoe7Q2JNR3ohxGi3X7kZSULHUoshW:zqnSoyMuJhPmvnGSRJyrk4V9ENoEdPsCM5bEUsbjb4eT1GHC57x9bT3AqddWsUdCYvtzfkBBhoPrX9gX5ekVX7BNb4ekzP2qTSATWsJdfFSpTtHXzNaK4RUifSvmpjqueV9cqGgdJQtQwy8Nx2UWpLdFPeuDWxWVzkP28tPhDqAnU6b4bht8qRtNMyyf3mSij2Cq3ccJe6HnruCFCEbapB2wUmbBzJBEMyzEFJmM1ghXm21qWjyb5Bq819xXSmAHo2hY8E5e6V2etNSfpi37fVa5zQmqSMPjqAqejP2RM4poF5F4J9ZqitA9LyuEUFnrYjfuYCZGUa2geZfAHAQ9MShXxPkVyMfjgGE4VjfaUjFncxXCcNhoeULJ843s65J4derLxTB9G3V9Lbk5zrjQYNbMWRHH8DtcrCL73vPPV4CmM1FsRquvS6W3j4p8rENxzLKiekrxfn6oMRH32e6AgZokPQn177G5sjaBDyoj5ZRkNdosDEWdN6F8qYp3K5a2hwBeVLLzUm3WpLjty4QAJmNcbKLVwgEhDHWqfzqmnEB1LgBwV1YXsSsbX25gmpP1tKUTYV4k5yErhAemgDRCChBiRS4tk2pDSSwFCEhDZAp75nfUYgZkXDX1pA2bqLfv'
      )
      expect(longFormDid).toBe(peerDidDocument.id)
    })
  })
})
