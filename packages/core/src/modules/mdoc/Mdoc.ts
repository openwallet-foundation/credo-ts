import type { AgentContext } from '../../agent'

import * as kmpCrypto from '@sphereon/kmp-crypto'
import * as kmpMdlMdoc from '@sphereon/kmp-mdl-mdoc'

import { JwaSignatureAlgorithm } from '../../crypto'
import { getJwkFromJson } from '../../crypto/jose/jwk/transform'
import { TypedArrayEncoder } from '../../utils'
import { X509Service, X509Certificate } from '../x509'

import { MdocError } from './MdocError'

type IssuerSignedJson = kmpMdlMdoc.com.sphereon.mdoc.data.device.IssuerSignedJson
type IssuerSignedCbor = kmpMdlMdoc.com.sphereon.mdoc.data.device.IssuerSignedCbor

export type MdocIssuerSignedItem<T = unknown> = kmpMdlMdoc.com.sphereon.mdoc.data.device.IssuerSignedItemJson<T>
export type MdocNamespaceData = Record<string, MdocIssuerSignedItem>
export type MdocNamespace = Record<string, MdocNamespaceData>

export class Mdoc {
  private issuerSignedJson: IssuerSignedJson
  private issuerSignedCbor: IssuerSignedCbor
  private _hexEncodedMdoc: string

  private constructor(hexEncodedMdoc: string) {
    this._hexEncodedMdoc = hexEncodedMdoc

    this.issuerSignedCbor = kmpMdlMdoc.com.sphereon.mdoc.data.device.IssuerSignedCbor.Companion.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromHex(hexEncodedMdoc))
    )
    this.issuerSignedJson = this.issuerSignedCbor.toJson()
  }

  public get docType() {
    // TODO: IMPLEMENT
    return ''
  }

  public get namespaces() {
    const namespaces: MdocNamespace = {}
    const entries = this.issuerSignedJson.nameSpaces?.asJsMapView().entries()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = entries?.next()
      if (next?.done) break
      if (!next?.value) {
        throw new MdocError('Missing value in Mdoc')
      }

      // TODO: THIS IS NOT SUFFICIENT
      const mdocDataItem = next.value[1]
      const mdocDataItemRecord: Record<string, MdocIssuerSignedItem> = Object.fromEntries(
        mdocDataItem.map((dataItem) => [dataItem.elementIdentifier, dataItem.elementValue])
      )

      namespaces[next.value[0]] = mdocDataItemRecord
    }

    return namespaces
  }

  public get jwaSignatureAlgorithm() {
    const alg = this.issuerSignedJson.issuerAuth.protectedHeader.alg?.name

    if (!alg || !Object.values(JwaSignatureAlgorithm).includes(alg as JwaSignatureAlgorithm)) {
      throw new MdocError(`Invalid Signature Algorithm on MDoc Document. Alg '${alg}'`)
    }

    return alg as JwaSignatureAlgorithm
  }

  public static fromHexEncodedMdoc(hexEncodedMdoc: string) {
    return new Mdoc(hexEncodedMdoc)
  }

  public static fromBase64UrlEncodedMdoc(base64UrlEncodedMdoc: string) {
    const hexEncodedMdoc = TypedArrayEncoder.fromBase64(base64UrlEncodedMdoc).toString('hex')

    return this.fromHexEncodedMdoc(hexEncodedMdoc)
  }

  public get hexEncodedMdoc() {
    return this._hexEncodedMdoc
  }

  public async verify(agentContext: AgentContext, options: { trustedCertificates: [string, ...string[]] }) {
    const { trustedCertificates } = options

    const x509ServiceObjectJS = kmpCrypto.com.sphereon.crypto.X509ServiceObjectJS
    const coseServiceObjectJS = kmpCrypto.com.sphereon.crypto.CoseCryptoServiceJS

    coseServiceObjectJS.register({
      __doNotUseOrImplementIt: {} as any,
      async sign1(coseCborInput, keyInfo) {
        if (!keyInfo?.key) {
          throw new MdocError('Missing key in mdoc cose sign callback')
        }
        const jwk = getJwkFromJson(keyInfo.key.toJson())
        const key = jwk.key

        if (!coseCborInput.payload) {
          throw new MdocError('Missing payload in mdoc cose sign callback.')
        }

        const data = TypedArrayEncoder.fromHex(coseCborInput.payload.toHexString())
        const signedPayload = await agentContext.wallet.sign({ data, key })

        // TODO: I CANNOT IMAGE THIS IS TRUE
        return new kmpCrypto.com.sphereon.cbor.cose.CoseSign1Cbor(
          coseCborInput.protectedHeader,
          coseCborInput.unprotectedHeader,
          coseCborInput.payload,
          new kmpCrypto.com.sphereon.cbor.CborByteString(new Int8Array(signedPayload))
        )
      },

      async verify1(input, keyInfo) {
        const success = await agentContext.wallet.verify({
          data: {} as any,
          key: {} as any,
          signature: {} as any,
        })

        return new kmpCrypto.com.sphereon.crypto.VerifySignatureResult(
          !success,
          'Signature Verification',
          !success,
          !success ? 'Invalid mdoc signature' : 'Signature correct',
          undefined
        )
      },
    })

    x509ServiceObjectJS.register({
      __doNotUseOrImplementIt: {} as any,
      getTrustedCerts() {
        return trustedCertificates
      },
      async verifyCertificateChainJS(chainDER) {
        if (!chainDER) {
          return new kmpCrypto.com.sphereon.crypto.X509VerificationResult(
            '',
            undefined,
            undefined,
            'name',
            false,
            'Missing ChainDER parameter when verifying the Certificate chain.',
            false
          )
        }

        try {
          await X509Service.validateCertificateChain(agentContext, {
            certificateChain: chainDER.map((value) =>
              X509Certificate.fromRawCertificate(new Uint8Array(value)).toString('base64url')
            ),
            trustedCertificates: trustedCertificates,
          })

          return new kmpCrypto.com.sphereon.crypto.X509VerificationResult(
            undefined,
            undefined,
            undefined,
            'success',
            false,
            'message',
            false
          )
        } catch (error) {
          return new kmpCrypto.com.sphereon.crypto.X509VerificationResult(
            '',
            undefined,
            undefined,
            'verification error',
            false,
            error instanceof Error
              ? error.message
              : 'An unknown error occurred during x509 certificate chain validation.',
            false
          ) as any
        }
      },
    })

    const res = await kmpCrypto.com.sphereon.crypto.CryptoServiceJS.X509.verifyCertificateChainJS(null, ['', ''], [''])

    const verificationResult = await kmpMdlMdoc.com.sphereon.mdoc.ValidationsJS.fromIssuerAuthAsync(
      this.issuerSignedCbor.issuerAuth,
      null,
      trustedCertificates
    )

    return
  }
}
