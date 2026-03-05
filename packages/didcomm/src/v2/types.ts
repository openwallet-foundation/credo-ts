/**
 * DIDComm v2 plaintext message format (DIF DIDComm Messaging spec).
 * Uses headers + body structure; `type` and `id` (no @ prefix).
 */
export interface DidCommV2PlaintextMessage {
  id: string
  type: string
  from?: string
  to?: string[]
  thid?: string
  pthid?: string
  created_time?: number
  expires_time?: number
  lang?: string
  attachments?: DidCommV2Attachment[]
  body?: Record<string, unknown>
  from_prior?: string
  [key: string]: unknown
}

/**
 * DIDComm v2 attachment format (DIF spec).
 * Maps to v1 ~attach (DidCommAttachment) with: id<->@id, media_type<->mime-type.
 */
export interface DidCommV2Attachment {
  id: string
  description?: string
  filename?: string
  media_type?: string
  format?: string
  lastmod_time?: string
  byte_count?: number
  data: {
    base64?: string
    json?: unknown
    links?: string[]
    hash?: string
    jws?: unknown
  }
}

export const DIDCOMM_V2_PLAIN_MIME_TYPE = 'application/didcomm-plain+json'
export const DIDCOMM_V2_ENCRYPTED_MIME_TYPE = 'application/didcomm-encrypted+json'

/**
 * DIDComm v2 encrypted message (JWE with typ application/didcomm-encrypted+json).
 * Same top-level structure as v1 for transport compatibility.
 */
export interface DidCommV2EncryptedMessage {
  protected: string
  iv: string
  ciphertext: string
  tag: string
}
