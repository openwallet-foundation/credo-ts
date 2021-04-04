import { Transform, TransformationType, ClassConstructor, plainToClass, classToPlain } from 'class-transformer'

import { PublicKey, publicKeyTypes } from '../publicKey'
import { Authentication } from './Authentication'
import { EmbeddedAuthentication } from './EmbeddedAuthentication'
import { ReferencedAuthentication } from './ReferencedAuthentication'

export const authenticationTypes = {
  RsaVerificationKey2018: 'RsaSignatureAuthentication2018',
  Ed25519VerificationKey2018: 'Ed25519SignatureAuthentication2018',
  Secp256k1VerificationKey2018: 'Secp256k1SignatureAuthenticationKey2018',
}

/**
 * Decorator that transforms authentication json to corresonding class instances. See {@link authenticationTypes}
 *
 * @example
 * class Example {
 *   AuthenticationTransformer()
 *   private authentication: Authentication
 * }
 */
export function AuthenticationTransformer() {
  return Transform(
    ({
      value,
      obj,
      type,
    }: {
      value: { type: string; publicKey?: string | PublicKey }[]
      obj: { publicKey: { id: string; type: string }[] }
      type: TransformationType
    }) => {
      // TODO: PLAIN_TO_PLAIN

      if (type === TransformationType.PLAIN_TO_CLASS) {
        return value.map((auth) => {
          // referenced public key
          if (auth.publicKey) {
            //referenced
            const publicKeyJson = obj.publicKey.find((publicKey) => publicKey.id === auth.publicKey)

            if (!publicKeyJson) {
              throw new Error(`Invalid public key referenced ${auth.publicKey}`)
            }

            // Referenced keys use other types than embedded keys.
            const publicKeyClass = (publicKeyTypes[publicKeyJson.type] ?? PublicKey) as ClassConstructor<PublicKey>
            const publicKey = plainToClass<PublicKey, unknown>(publicKeyClass, publicKeyJson)
            return new ReferencedAuthentication(publicKey, auth.type)
          } else {
            // embedded
            const publicKeyClass = (publicKeyTypes[auth.type] ?? PublicKey) as ClassConstructor<PublicKey>
            const publicKey = plainToClass<PublicKey, unknown>(publicKeyClass, auth)
            return new EmbeddedAuthentication(publicKey)
          }
        })
      } else {
        return value.map((auth) => (auth instanceof EmbeddedAuthentication ? classToPlain(auth.publicKey) : auth))
      }
    }
  )
}

export { Authentication, EmbeddedAuthentication, ReferencedAuthentication }
