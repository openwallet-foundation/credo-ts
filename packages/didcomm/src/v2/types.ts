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
export const DIDCOMM_V2_SIGNED_MIME_TYPE = 'application/didcomm-signed+json'

export type DidCommV2ContentEncryptionAlgorithm = 'A256GCM' | 'A256CBC-HS512'

export interface DidCommV2JweRecipient {
  header: { kid: string }
  encrypted_key: string
}

/**
 * DIDComm v2 encrypted message (JWE in JSON General Serialization, typ application/didcomm-encrypted+json).
 * The shared ephemeral public key and all KDF/alg parameters live in the protected header;
 * recipients is top-level and per-recipient headers contain only the kid.
 */
export interface DidCommV2EncryptedMessage {
  protected: string
  recipients: DidCommV2JweRecipient[]
  iv: string
  ciphertext: string
  tag: string
}

export interface DidCommV2JwsSignature {
  protected: string
  signature: string
  header: { kid: string }
}

/**
 * DIDComm v2 signed message (JWS in JSON General Serialization, typ application/didcomm-signed+json).
 * `payload` is the base64url-encoded plaintext bytes; per-signature `kid` lives in the unprotected header.
 */
export interface DidCommV2SignedMessage {
  payload: string
  signatures: DidCommV2JwsSignature[]
}
