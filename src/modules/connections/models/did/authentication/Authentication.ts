import { PublicKey } from '../publicKey/PublicKey'

export abstract class Authentication {
  abstract publicKey: PublicKey
}
