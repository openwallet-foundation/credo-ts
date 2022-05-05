import { JsonEncoder, MultiBaseEncoder, MultiHashEncoder } from '../../../../utils'

export function didDocumentJsonToNumAlgo1Did(didDocumentJson: Record<string, unknown>): string {
  // We need to remove the id property before hashing
  const didDocumentBuffer = JsonEncoder.toBuffer({ ...didDocumentJson, id: undefined })

  const didIdentifier = MultiBaseEncoder.encode(MultiHashEncoder.encode(didDocumentBuffer, 'sha2-256'), 'base58btc')

  const did = `did:peer:1${didIdentifier}`

  return did
}
