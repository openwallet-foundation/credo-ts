import type { Verkey } from 'indy-sdk'
import { WireMessage } from '../types'

export interface MessageRepository {
  findByVerkey(verkey: Verkey): WireMessage[]
  deleteAllByVerkey(verkey: Verkey): void
  save(key: Verkey, payload: WireMessage): void
}
