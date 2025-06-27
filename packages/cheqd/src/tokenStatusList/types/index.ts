export type StatusListToken = {
  jwt: string // Signed JWT
  metadata: {
    statusListId: string
    issuedAt: number
    size: number
  }
}

export type StatusListPayload = {
  iss: string
  iat: number
  status_list: {
    encoding: 'bitstring'
    bits: string // base64url-encoded compressed bitmap
  }
}
