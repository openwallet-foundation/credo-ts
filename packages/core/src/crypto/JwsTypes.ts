export interface JwsGeneralFormat {
  header: Record<string, unknown>
  signature: string
  protected: string
}

export interface JwsFlattenedFormat {
  signatures: JwsGeneralFormat[]
}

export type Jws = JwsGeneralFormat | JwsFlattenedFormat
