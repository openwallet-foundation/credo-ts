export type Item = {
  id: Uint8Array
  category: Uint8Array
  name: Uint8Array
  value: Uint8Array
  type: Uint8Array
  // 0: plaintext
  // 1: name
  // 2: value
  tags?: Tags
}

export type Key = {
  tvk: Uint8Array
  thk: Uint8Array
  tnk: Uint8Array
  ick: Uint8Array
  ihk: Uint8Array
  ink: Uint8Array
}

export type Tag = [number, Uint8Array, Uint8Array]
export type Tags = Array<Tag>

export type Keys = {
  value: Uint8Array
  tag_name: Uint8Array
  tag_value: Uint8Array
  type: Uint8Array
  name: Uint8Array
}

export type IndyKey = {
  type: Buffer
  name: Buffer
  value: Buffer
  item_hmac: Buffer
  tag_name: Buffer
  tag_value: Buffer
  tag_hmac: Buffer
  master: Buffer
  salt: Uint8Array
}

export type ProfileKey = {
  ver: string
  ick: Buffer
  ink: Buffer
  ihk: Buffer
  tnk: Buffer
  tvk: Buffer
  thk: Buffer
}

export type ItemFromDb = {
  id: number
  type: Buffer
  name: Buffer
  value: Buffer
  key: Buffer
  // TODO: confirm types might be buffer
  tags_enc: string | null
  tags_plain: string | null
}
