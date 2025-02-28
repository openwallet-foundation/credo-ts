import type { EncryptedMessage } from '@credo-ts/core'

import { Buffer, JsonEncoder, JsonTransformer, Key, KeyType, TypedArrayEncoder, WalletError } from '@credo-ts/core'
import { Key as AskarKey, CryptoBox, KeyAlgorithm } from '@openwallet-foundation/askar-shared'

import { JweEnvelope, JweRecipient } from './JweEnvelope'

export function didcommV1Pack(payload: Record<string, unknown>, recipientKeys: string[], senderKey?: AskarKey) {
  let cek: AskarKey | undefined
  let senderExchangeKey: AskarKey | undefined

  try {
    cek = AskarKey.generate(KeyAlgorithm.Chacha20C20P)

    senderExchangeKey = senderKey ? senderKey.convertkey({ algorithm: KeyAlgorithm.X25519 }) : undefined

    const recipients: JweRecipient[] = []

    for (const recipientKey of recipientKeys) {
      let targetExchangeKey: AskarKey | undefined
      try {
        targetExchangeKey = AskarKey.fromPublicBytes({
          publicKey: Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519).publicKey,
          algorithm: KeyAlgorithm.Ed25519,
        }).convertkey({ algorithm: KeyAlgorithm.X25519 })

        if (senderKey && senderExchangeKey) {
          const encryptedSender = CryptoBox.seal({
            recipientKey: targetExchangeKey,
            message: TypedArrayEncoder.fromString(TypedArrayEncoder.toBase58(senderKey.publicBytes)),
          })
          const nonce = CryptoBox.randomNonce()
          const encryptedCek = CryptoBox.cryptoBox({
            recipientKey: targetExchangeKey,
            senderKey: senderExchangeKey,
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
          const encryptedCek = CryptoBox.seal({
            recipientKey: targetExchangeKey,
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

export function didcommV1Unpack(messagePackage: EncryptedMessage, recipientKey: AskarKey) {
  const protectedJson = JsonEncoder.fromBase64(messagePackage.protected)

  const alg = protectedJson.alg
  if (!['Anoncrypt', 'Authcrypt'].includes(alg)) {
    throw new WalletError(`Unsupported pack algorithm: ${alg}`)
  }

  const recipient = protectedJson.recipients.find(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
  }
  if (!sender && iv) {
    throw new WalletError('Unexpected IV')
  }

  let payloadKey: Uint8Array
  let senderKey: string | undefined

  let sender_x: AskarKey | undefined
  let recip_x: AskarKey | undefined

  try {
    recip_x = recipientKey.convertkey({ algorithm: KeyAlgorithm.X25519 })

    if (sender && iv) {
      senderKey = TypedArrayEncoder.toUtf8String(
        CryptoBox.sealOpen({
          recipientKey: recip_x,
          ciphertext: sender,
        })
      )
      sender_x = AskarKey.fromPublicBytes({
        algorithm: KeyAlgorithm.Ed25519,
        publicKey: TypedArrayEncoder.fromBase58(senderKey),
      }).convertkey({ algorithm: KeyAlgorithm.X25519 })

      payloadKey = CryptoBox.open({
        recipientKey: recip_x,
        senderKey: sender_x,
        message: encrypted_key,
        nonce: iv,
      })
    } else {
      payloadKey = CryptoBox.sealOpen({ ciphertext: encrypted_key, recipientKey: recip_x })
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
    cek = AskarKey.fromSecretBytes({ algorithm: KeyAlgorithm.Chacha20C20P, secretKey: payloadKey })
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
