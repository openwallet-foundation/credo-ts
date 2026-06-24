import { decodeSdJwtSync, getClaimsSync } from '@sd-jwt/decode'
import { Hasher } from '../../crypto'
import { ClaimFormat } from '../vc/index'
import type { SdJwtVcHeader, SdJwtVcPayload } from './SdJwtVcOptions'
import type { SdJwtVc } from './SdJwtVcService'
import type { SdJwtVcTypeMetadata } from './typeMetadata'
import { parseHolderBindingFromCredential, parseIssuerFromCredential } from './utils'

export function sdJwtVcHasher(data: string | ArrayBufferLike, alg: string) {
  return Hasher.hash(typeof data === 'string' ? data : new Uint8Array(data), alg)
}

export function decodeSdJwtVc<
  Header extends SdJwtVcHeader = SdJwtVcHeader,
  Payload extends SdJwtVcPayload = SdJwtVcPayload,
>(compactSdJwtVc: string, typeMetadata?: SdJwtVcTypeMetadata): SdJwtVc<Header, Payload> {
  // NOTE: we use decodeSdJwtSync so we can make this method sync
  const { jwt, disclosures, kbJwt } = decodeSdJwtSync(compactSdJwtVc, sdJwtVcHasher)
  const prettyClaims = getClaimsSync(jwt.payload, disclosures, sdJwtVcHasher)

  // Decoding is structural and best-effort: a credential whose issuer cannot be resolved to a
  // supported signing method (did/x5c) is still decoded, with `issuer` left undefined. Verification
  // re-parses the issuer and enforces a supported method.
  let issuer: SdJwtVc<Header, Payload>['issuer']
  try {
    issuer = parseIssuerFromCredential(jwt.header, jwt.payload)
  } catch {
    issuer = undefined
  }

  return {
    compact: compactSdJwtVc,
    header: jwt.header as Header,
    payload: jwt.payload as Payload,
    issuer,
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
