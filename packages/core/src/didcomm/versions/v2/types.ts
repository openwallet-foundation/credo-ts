export interface PlaintextDidCommV2Message {
  type: string
  id: string
  from?: string
  to?: string[]

  [key: string]: unknown
}
