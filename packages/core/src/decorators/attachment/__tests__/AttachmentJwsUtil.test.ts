import { getAgentConfig } from '../../../../tests/helpers'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { AttachmentJws, signAttachmentJws, verifyAttachmentJws } from '../AttachmentJwsUtil'

import * as didJwsz6Mkf from './__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from './__fixtures__/didJwsz6Mkv'

describe('Decorators | Attachment | AttachmentJwsUtil', () => {
  let wallet: IndyWallet

  beforeAll(async () => {
    const config = getAgentConfig('AttachmentJwsUtilTest')
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.initialize(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('signAttachmentJws()', () => {
    test('signs base64 data and returns a JWS in flattened format with a single verkey', async () => {
      const { verkey } = await wallet.createDid({ seed: didJwsz6Mkv.SEED })

      const base64Payload = JsonEncoder.toBase64(didJwsz6Mkv.DATA_JSON)
      const jws = await signAttachmentJws(wallet, [verkey], base64Payload)

      const json = JsonTransformer.toJSON(jws)

      expect(json).toEqual(didJwsz6Mkv.JWS_JSON)
    })

    test('signs base64 data and returns a JWS in general format with multiple verkeys', async () => {
      const { verkey: verkeyJws } = await wallet.createDid({ seed: didJwsz6Mkf.SEED })
      const { verkey: verkeyJwsz6Mkv } = await wallet.createDid({ seed: didJwsz6Mkv.SEED })

      const base64Payload = JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON)
      const jws = await signAttachmentJws(wallet, [verkeyJws, verkeyJwsz6Mkv], base64Payload)

      const json = JsonTransformer.toJSON(jws)

      expect(json).toEqual({
        signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON],
      })
    })
  })

  describe('verifyAttachmentJws', () => {
    test('returns true for a valid jws with a single signature', async () => {
      const jws = JsonTransformer.fromJSON(didJwsz6Mkv.JWS_JSON, AttachmentJws)
      const base64Payload = JsonEncoder.toBase64(didJwsz6Mkv.DATA_JSON)

      const isValid = await verifyAttachmentJws(wallet, jws, base64Payload)

      expect(isValid).toBe(true)
    })

    test('returns true for a valid jws with multiple signatures', async () => {
      const jws = JsonTransformer.fromJSON(
        {
          signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON],
        },
        AttachmentJws
      )
      const base64Payload = JsonEncoder.toBase64(didJwsz6Mkv.DATA_JSON)

      const isValid = await verifyAttachmentJws(wallet, jws, base64Payload)

      expect(isValid).toBe(true)
    })

    test('returns false when the signed payload has been tampered with', async () => {
      const jws = JsonTransformer.fromJSON(didJwsz6Mkf.JWS_JSON, AttachmentJws)

      const base64Payload = JsonEncoder.toBase64({ ...didJwsz6Mkf.DATA_JSON, did: 'another_did' })

      const isValid = await verifyAttachmentJws(wallet, jws, base64Payload)

      expect(isValid).toBe(false)
    })

    test('returns false when the signature has been tampered with', async () => {
      const jws = JsonTransformer.fromJSON(didJwsz6Mkf.JWS_JSON, AttachmentJws)

      jws.signature = `${jws.signature}-extra`

      const base64Payload = JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON)

      const isValid = await verifyAttachmentJws(wallet, jws, base64Payload)

      expect(isValid).toBe(false)
    })
  })
})
