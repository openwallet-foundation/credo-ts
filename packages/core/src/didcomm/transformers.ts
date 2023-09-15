import { Attachment, AttachmentData, V2Attachment, V2AttachmentData } from '../decorators/attachment'

export function toV2Attachment(v1Attachment: Attachment): V2Attachment {
  const { id, description, byteCount, filename, lastmodTime, mimeType, data } = v1Attachment
  return new V2Attachment({
    id,
    description,
    byteCount,
    filename,
    lastmodTime,
    mediaType: mimeType,
    data: new V2AttachmentData({
      base64: data.base64,
      json: data.json,
      jws: data.jws,
      links: data.links,
      hash: data.sha256,
    }),
  })
}

export function toV1Attachment(v2Attachment: V2Attachment): Attachment {
  const { id, description, byteCount, filename, lastmodTime, mediaType, data } = v2Attachment
  return new Attachment({
    id,
    description,
    byteCount,
    filename,
    lastmodTime,
    mimeType: mediaType,
    data: new AttachmentData({
      base64: data.base64,
      json: data.json,
      jws: data.jws,
      links: data.links,
      sha256: data.hash,
    }),
  })
}
