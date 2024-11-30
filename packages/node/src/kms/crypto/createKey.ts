import { Kms } from '@credo-ts/core'
import { generateKeyPair as _generateKeyPair, generateKey as _generateKey } from 'node:crypto'
import { promisify } from 'node:util'

const generateKeyPair = promisify(_generateKeyPair)
const generateKey = promisify(_generateKey)

const nodeSupportedEcCrvs = ['P-256', 'P-384', 'P-521', 'secp256k1'] satisfies Kms.KmsJwkPublicEc['crv'][]
type NodeKmsSupportedEcCrvs = (typeof nodeSupportedEcCrvs)[number]
export function assertNodeSupportedEcCrv(
  options: Kms.KmsCreateKeyTypeEc
): asserts options is Kms.KmsCreateKeyTypeEc & { crv: NodeKmsSupportedEcCrvs } {
  if (!nodeSupportedEcCrvs.includes(options.crv as NodeKmsSupportedEcCrvs)) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${options.crv}' for kty '${options.kty}'`, 'node')
  }
}

export async function createEcKey({ crv }: Kms.KmsCreateKeyTypeEc & { crv: NodeKmsSupportedEcCrvs }) {
  const { publicKey, privateKey } = await generateKeyPair('ec', {
    namedCurve: crv,
  })

  const privateJwk = privateKey.export({
    format: 'jwk',
  })

  const publicJwk = publicKey.export({
    format: 'jwk',
  })

  return {
    privateJwk: privateJwk as Kms.KmsJwkPrivate,
    publicJwk: publicJwk as Kms.KmsJwkPublic,
  }
}

export async function createRsaKey({ modulusLength }: Kms.KmsCreateKeyTypeRsa) {
  const { publicKey, privateKey } = await generateKeyPair('rsa', {
    modulusLength,
  })

  const privateJwk = privateKey.export({
    format: 'jwk',
  })

  const publicJwk = publicKey.export({
    format: 'jwk',
  })

  return {
    privateJwk: privateJwk as Kms.KmsJwkPrivate,
    publicJwk: publicJwk as Kms.KmsJwkPublic,
  }
}

const nodeSupportedOkpCrvs = ['Ed25519', 'X25519'] satisfies Kms.KmsJwkPublicOkp['crv'][]
type NodeKmsSupportedOkpCrvs = (typeof nodeSupportedOkpCrvs)[number]
export function assertNodeSupportedOkpCrv(
  options: Kms.KmsCreateKeyTypeOkp
): asserts options is Kms.KmsCreateKeyTypeOkp & { crv: NodeKmsSupportedOkpCrvs } {
  if (!nodeSupportedOkpCrvs.includes(options.crv as NodeKmsSupportedOkpCrvs)) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${options.crv}' for kty '${options.kty}'`, 'node')
  }
}

export async function createOkpKey({ crv }: Kms.KmsCreateKeyTypeOkp & { crv: NodeKmsSupportedOkpCrvs }) {
  const { publicKey, privateKey } =
    crv === 'Ed25519' ? await generateKeyPair('ed25519') : await generateKeyPair('x25519')

  const privateJwk = privateKey.export({
    format: 'jwk',
  })

  const publicJwk = publicKey.export({
    format: 'jwk',
  })

  return {
    privateJwk: privateJwk as Kms.KmsJwkPrivate,
    publicJwk: publicJwk as Kms.KmsJwkPublic,
  }
}

const nodeSupportedOctAlgorithms = ['aes', 'hmac'] satisfies Kms.KmsCreateKeyTypeOct['algorithm'][]
type NodeSupportedOctAlgorithms = (typeof nodeSupportedOctAlgorithms)[number]
export function assertNodeSupportedOctAlgorithm(
  options: Kms.KmsCreateKeyTypeOct
): asserts options is Kms.KmsCreateKeyTypeOct & { algorithm: NodeSupportedOctAlgorithms } {
  if (!nodeSupportedOctAlgorithms.includes(options.algorithm as NodeSupportedOctAlgorithms)) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `algorithm '${options.algorithm}' for kty '${options.kty}'`,
      'node'
    )
  }
}

export async function createOctKey(options: Kms.KmsCreateKeyTypeOct & { algorithm: NodeSupportedOctAlgorithms }) {
  const key = await generateKey(options.algorithm, { length: options.length })

  const privateJwk = key.export({ format: 'jwk' })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { k, ...publicJwk } = privateJwk

  return {
    privateJwk: privateJwk as Kms.KmsJwkPrivate,
    publicJwk: publicJwk as Kms.KmsJwkPublic,
  }
}
