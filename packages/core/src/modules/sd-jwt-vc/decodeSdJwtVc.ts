import { decodeSdJwtSync, getClaimsSync } from '@sd-jwt/decode'
import type { HasherSync as SdJwtVcHasherSync } from '@sd-jwt/types'
import { Hasher } from '../../crypto'
import type { Uint8ArrayBuffer } from '../../types'
import { ClaimFormat } from '../vc/index'
import type { SdJwtVcHeader, SdJwtVcPayload } from './SdJwtVcOptions'
import type { SdJwtVc } from './SdJwtVcService'
import type { SdJwtVcTypeMetadata } from './typeMetadata'
import { parseHolderBindingFromCredential } from './utils'

export const sdJwtVcHasher: SdJwtVcHasherSync = (data: string | ArrayBuffer, alg: string) => {
  return Hasher.hash(data as string | Uint8ArrayBuffer, alg)
}

export function decodeSdJwtVc<
  Header extends SdJwtVcHeader = SdJwtVcHeader,
  Payload extends SdJwtVcPayload = SdJwtVcPayload,
>(compactSdJwtVc: string, typeMetadata?: SdJwtVcTypeMetadata): SdJwtVc<Header, Payload> {
  // NOTE: we use decodeSdJwtSync so we can make this method sync
  const { jwt, disclosures, kbJwt } = decodeSdJwtSync(compactSdJwtVc, sdJwtVcHasher)
  const prettyClaims = getClaimsSync(jwt.payload, disclosures, sdJwtVcHasher)

  return {
    compact: compactSdJwtVc,
    header: jwt.header as Header,
    payload: jwt.payload as Payload,
    holder: parseHolderBindingFromCredential(jwt.payload) ?? undefined,
    prettyClaims: prettyClaims as Payload,
    claimFormat: ClaimFormat.SdJwtDc,
    encoded: compactSdJwtVc,
    kbJwt: kbJwt
      ? {
          payload: kbJwt.payload as Record<string, unknown>,
          header: kbJwt.header as Record<string, unknown>,
        }
      : undefined,
    ...(typeMetadata && { typeMetadata }),
  }
}
