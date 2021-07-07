import type { WireMessage } from '../types'
import type { Verkey } from 'indy-sdk'

export interface MessageRepository {
  findByVerkey(verkey: Verkey): WireMessage[]
  deleteAllByVerkey(verkey: Verkey): void
  save(key: Verkey, payload: WireMessage): void
}
