import type { JwtPayloadOptions } from '../../../crypto/jose/jwt'
import { JwtPayload } from '../../../crypto/jose/jwt'
import { CredoError } from '../../../error'
import { isJsonObject } from '../../../types'
import { JsonTransformer } from '../../../utils'
import type { W3cJsonPresentation } from '../models/presentation/W3cJsonPresentation'
import { W3cPresentation } from '../models/presentation/W3cPresentation'

export function getJwtPayloadFromPresentation(presentation: W3cPresentation) {
  const vp = JsonTransformer.toJSON(presentation) as Partial<W3cJsonPresentation>

  const payloadOptions: JwtPayloadOptions = {
    additionalClaims: {
      vp,
    },
  }

  // Extract `iss` and remove holder id from vp
  if (presentation.holderId) {
    payloadOptions.iss = presentation.holderId

    if (typeof vp.holder === 'string') {
      // biome-ignore lint/performance/noDelete: no explanation
      delete vp.holder
    } else if (typeof vp.holder === 'object') {
      // biome-ignore lint/performance/noDelete: no explanation
      delete vp.holder.id
      if (Object.keys(vp.holder).length === 0) {
        // biome-ignore lint/performance/noDelete: no explanation
        delete vp.holder
      }
    }
  }

  // Extract `jti` and remove id from vp
  if (presentation.id) {
    payloadOptions.jti = presentation.id
    // biome-ignore lint/performance/noDelete: no explanation
    delete vp.id
  }

  return new JwtPayload(payloadOptions)
}

export function getPresentationFromJwtPayload(jwtPayload: JwtPayload) {
  if (!('vp' in jwtPayload.additionalClaims) || !isJsonObject(jwtPayload.additionalClaims.vp)) {
    throw new CredoError("JWT does not contain a valid 'vp' claim")
  }

  const jwtVp = jwtPayload.additionalClaims.vp

  // Validate vp.id and jti
  if (jwtVp.id && jwtPayload.jti !== jwtVp.id) {
    throw new CredoError('JWT jti and vp.id do not match')
  }

  // Validate vp.holder and iss
  if (
    (typeof jwtVp.holder === 'string' && jwtPayload.iss !== jwtVp.holder) ||
    (isJsonObject(jwtVp.holder) && jwtVp.holder.id && jwtPayload.iss !== jwtVp.holder.id)
  ) {
    throw new CredoError('JWT iss and vp.holder(.id) do not match')
  }

  const dataModelVp = {
    ...jwtVp,
    id: jwtPayload.jti,
    holder: jwtPayload.iss,
  }

  const vpInstance = JsonTransformer.fromJSON(dataModelVp, W3cPresentation)

  return vpInstance
}
