import type {
  AskarLibrary,
  HyperledgerAskarKey,
  HyperledgerAskarLibrary,
  OwfAskarKey,
  OwfAskarLibrary,
  AskarKey,
} from '../utils/importAskar'
import type { EncryptedMessage } from '@credo-ts/core'

import { WalletError, JsonEncoder, JsonTransformer, Key, KeyType, TypedArrayEncoder, Buffer } from '@credo-ts/core'

import { isOwfAskarKey, isOwfAskarLibrary } from '../utils/importAskar'

import { JweEnvelope, JweRecipient } from './JweEnvelope'

export function didcommV1Pack(
  askarLibrary: AskarLibrary,
  payload: Record<string, unknown>,
  recipientKeys: string[],
  senderKey?: AskarKey
) {
  let cek: AskarKey | undefined
  let senderExchangeKey: AskarKey | undefined

  try {
    cek = isOwfAskarLibrary(askarLibrary)
      ? askarLibrary.Key.generate(askarLibrary.KeyAlgorithm.Chacha20C20P)
      : askarLibrary.Key.generate(askarLibrary.KeyAlgs.Chacha20C20P)

    const keyAlgorithm = isOwfAskarLibrary(askarLibrary)
      ? askarLibrary.KeyAlgorithm.X25519
      : askarLibrary.KeyAlgs.X25519

    senderExchangeKey = senderKey
      ? isOwfAskarKey(askarLibrary, senderKey)
        ? senderKey.convertkey({ algorithm: keyAlgorithm as OwfAskarLibrary['KeyAlgorithm']['X25519'] })
        : senderKey.convertkey({ algorithm: keyAlgorithm as HyperledgerAskarLibrary['KeyAlgs']['X25519'] })
      : undefined

    const recipients: JweRecipient[] = []

    for (const recipientKey of recipientKeys) {
      let targetExchangeKey: AskarKey | undefined
      try {
        targetExchangeKey = isOwfAskarLibrary(askarLibrary)
          ? askarLibrary.Key.fromPublicBytes({
              publicKey: Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519).publicKey,
              algorithm: askarLibrary.KeyAlgorithm.Ed25519,
            }).convertkey({ algorithm: askarLibrary.KeyAlgorithm.X25519 })
          : askarLibrary.Key.fromPublicBytes({
              publicKey: Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519).publicKey,
              algorithm: askarLibrary.KeyAlgs.Ed25519,
            }).convertkey({ algorithm: askarLibrary.KeyAlgs.X25519 })

        if (senderKey && senderExchangeKey) {
          const message = TypedArrayEncoder.fromString(TypedArrayEncoder.toBase58(senderKey.publicBytes))
          const encryptedSender = isOwfAskarLibrary(askarLibrary)
            ? askarLibrary.CryptoBox.seal({
                recipientKey: targetExchangeKey as InstanceType<OwfAskarLibrary['Key']>,
                message,
              })
            : askarLibrary.CryptoBox.seal({
                recipientKey: targetExchangeKey as InstanceType<HyperledgerAskarLibrary['Key']>,
                message,
              })
          const nonce = askarLibrary.CryptoBox.randomNonce()
          const encryptedCek = isOwfAskarLibrary(askarLibrary)
            ? askarLibrary.CryptoBox.cryptoBox({
                recipientKey: targetExchangeKey as OwfAskarKey,
                senderKey: senderExchangeKey as OwfAskarKey,
                message: cek.secretBytes,
                nonce,
              })
            : askarLibrary.CryptoBox.cryptoBox({
                recipientKey: targetExchangeKey as HyperledgerAskarKey,
                senderKey: senderExchangeKey as HyperledgerAskarKey,
                message: cek.secretBytes,
                nonce,
              })

          recipients.push(
            new JweRecipient({
              encryptedKey: encryptedCek,
              header: {
                kid: recipientKey,
                sender: TypedArrayEncoder.toBase64URL(encryptedSender),
                iv: TypedArrayEncoder.toBase64URL(nonce),
              },
            })
          )
        } else {
          const encryptedCek = isOwfAskarLibrary(askarLibrary)
            ? askarLibrary.CryptoBox.seal({
                recipientKey: targetExchangeKey as OwfAskarKey,
                message: cek.secretBytes,
              })
            : askarLibrary.CryptoBox.seal({
                recipientKey: targetExchangeKey as HyperledgerAskarKey,
                message: cek.secretBytes,
              })
          recipients.push(
            new JweRecipient({
              encryptedKey: encryptedCek,
              header: {
                kid: recipientKey,
              },
            })
          )
        }
      } finally {
        targetExchangeKey?.handle.free()
      }
    }

    const protectedJson = {
      enc: 'xchacha20poly1305_ietf',
      typ: 'JWM/1.0',
      alg: senderKey ? 'Authcrypt' : 'Anoncrypt',
      recipients: recipients.map((item) => JsonTransformer.toJSON(item)),
    }

    const { ciphertext, tag, nonce } = cek.aeadEncrypt({
      message: Buffer.from(JSON.stringify(payload)),
      aad: Buffer.from(JsonEncoder.toBase64URL(protectedJson)),
    }).parts

    const envelope = new JweEnvelope({
      ciphertext: TypedArrayEncoder.toBase64URL(ciphertext),
      iv: TypedArrayEncoder.toBase64URL(nonce),
      protected: JsonEncoder.toBase64URL(protectedJson),
      tag: TypedArrayEncoder.toBase64URL(tag),
    }).toJson()

    return envelope as EncryptedMessage
  } finally {
    cek?.handle.free()
    senderExchangeKey?.handle.free()
  }
}

export function didcommV1Unpack(askarLibrary: AskarLibrary, messagePackage: EncryptedMessage, recipientKey: AskarKey) {
  const protectedJson = JsonEncoder.fromBase64(messagePackage.protected)

  const alg = protectedJson.alg
  if (!['Anoncrypt', 'Authcrypt'].includes(alg)) {
    throw new WalletError(`Unsupported pack algorithm: ${alg}`)
  }

  const recipient = protectedJson.recipients.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.header.kid === TypedArrayEncoder.toBase58(recipientKey.publicBytes)
  )

  if (!recipient) {
    throw new WalletError('No corresponding recipient key found')
  }

  const sender = recipient?.header.sender ? TypedArrayEncoder.fromBase64(recipient.header.sender) : undefined
  const iv = recipient?.header.iv ? TypedArrayEncoder.fromBase64(recipient.header.iv) : undefined
  const encrypted_key = TypedArrayEncoder.fromBase64(recipient.encrypted_key)

  if (sender && !iv) {
    throw new WalletError('Missing IV')
  } else if (!sender && iv) {
    throw new WalletError('Unexpected IV')
  }

  let payloadKey, senderKey

  let sender_x: AskarKey | undefined
  let recip_x: AskarKey | undefined

  try {
    const keyAlgorithm = isOwfAskarLibrary(askarLibrary)
      ? askarLibrary.KeyAlgorithm.X25519
      : askarLibrary.KeyAlgs.X25519
    recip_x = isOwfAskarKey(askarLibrary, recipientKey)
      ? recipientKey.convertkey({ algorithm: keyAlgorithm as OwfAskarLibrary['KeyAlgorithm']['X25519'] })
      : recipientKey.convertkey({ algorithm: keyAlgorithm as HyperledgerAskarLibrary['KeyAlgs']['X25519'] })

    if (sender && iv) {
      senderKey = TypedArrayEncoder.toUtf8String(
        isOwfAskarLibrary(askarLibrary)
          ? askarLibrary.CryptoBox.sealOpen({
              recipientKey: recip_x as OwfAskarKey,
              ciphertext: sender,
            })
          : askarLibrary.CryptoBox.sealOpen({
              recipientKey: recip_x as HyperledgerAskarKey,
              ciphertext: sender,
            })
      )
      sender_x = isOwfAskarLibrary(askarLibrary)
        ? askarLibrary.Key.fromPublicBytes({
            algorithm: askarLibrary.KeyAlgorithm.Ed25519,
            publicKey: TypedArrayEncoder.fromBase58(senderKey),
          }).convertkey({ algorithm: askarLibrary.KeyAlgorithm.X25519 })
        : askarLibrary.Key.fromPublicBytes({
            algorithm: askarLibrary.KeyAlgs.Ed25519,
            publicKey: TypedArrayEncoder.fromBase58(senderKey),
          }).convertkey({ algorithm: askarLibrary.KeyAlgs.X25519 })

      payloadKey = isOwfAskarLibrary(askarLibrary)
        ? askarLibrary.CryptoBox.open({
            recipientKey: recip_x as OwfAskarKey,
            senderKey: sender_x as OwfAskarKey,
            message: encrypted_key,
            nonce: iv,
          })
        : askarLibrary.CryptoBox.open({
            recipientKey: recip_x as HyperledgerAskarKey,
            senderKey: sender_x as HyperledgerAskarKey,
            message: encrypted_key,
            nonce: iv,
          })
    } else {
      payloadKey = isOwfAskarLibrary(askarLibrary)
        ? askarLibrary.CryptoBox.sealOpen({ ciphertext: encrypted_key, recipientKey: recip_x as OwfAskarKey })
        : askarLibrary.CryptoBox.sealOpen({ ciphertext: encrypted_key, recipientKey: recip_x as HyperledgerAskarKey })
    }
  } finally {
    sender_x?.handle.free()
    recip_x?.handle.free()
  }

  if (!senderKey && alg === 'Authcrypt') {
    throw new WalletError('Sender public key not provided for Authcrypt')
  }

  let cek: AskarKey | undefined
  try {
    cek = isOwfAskarLibrary(askarLibrary)
      ? askarLibrary.Key.fromSecretBytes({ algorithm: askarLibrary.KeyAlgorithm.Chacha20C20P, secretKey: payloadKey })
      : askarLibrary.Key.fromSecretBytes({ algorithm: askarLibrary.KeyAlgs.Chacha20C20P, secretKey: payloadKey })
    const message = cek.aeadDecrypt({
      ciphertext: TypedArrayEncoder.fromBase64(messagePackage.ciphertext),
      nonce: TypedArrayEncoder.fromBase64(messagePackage.iv),
      tag: TypedArrayEncoder.fromBase64(messagePackage.tag),
      aad: TypedArrayEncoder.fromString(messagePackage.protected),
    })
    return {
      plaintextMessage: JsonEncoder.fromBuffer(message),
      senderKey,
      recipientKey: TypedArrayEncoder.toBase58(recipientKey.publicBytes),
    }
  } finally {
    cek?.handle.free()
  }
}
