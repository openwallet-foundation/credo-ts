import type { JwtPayloadOptions } from '../../../crypto/jose/jwt'
import type { W3cJsonCredential } from '../models/credential/W3cJsonCredential'

import { isObject } from 'class-validator'

import { JwtPayload } from '../../../crypto/jose/jwt'
import { CredoError } from '../../../error'
import { JsonTransformer, isJsonObject } from '../../../utils'
import { W3cCredential } from '../models/credential/W3cCredential'
import { w3cDate } from '../util'

export function getJwtPayloadFromCredential(credential: W3cCredential) {
  const vc = JsonTransformer.toJSON(credential) as Partial<W3cJsonCredential>

  const payloadOptions: JwtPayloadOptions = {
    additionalClaims: {
      vc,
    },
  }

  // Extract `nbf` and remove issuance date from vc
  const issuanceDate = Date.parse(credential.issuanceDate)
  if (Number.isNaN(issuanceDate)) {
    throw new CredoError('JWT VCs must have a valid issuance date')
  }
  payloadOptions.nbf = Math.floor(issuanceDate / 1000)
  // biome-ignore lint/performance/noDelete: <explanation>
  delete vc.issuanceDate

  // Extract `exp` and remove expiration date from vc
  if (credential.expirationDate) {
    const expirationDate = Date.parse(credential.expirationDate)
    if (!Number.isNaN(expirationDate)) {
      payloadOptions.exp = Math.floor(expirationDate / 1000)
      // biome-ignore lint/performance/noDelete: <explanation>
      delete vc.expirationDate
    }
  }

  // Extract `iss` and remove issuer id from vc
  payloadOptions.iss = credential.issuerId
  if (typeof vc.issuer === 'string') {
    // biome-ignore lint/performance/noDelete: <explanation>
    delete vc.issuer
  } else if (typeof vc.issuer === 'object') {
    // biome-ignore lint/performance/noDelete: <explanation>
    delete vc.issuer.id
    if (Object.keys(vc.issuer).length === 0) {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete vc.issuer
    }
  }

  // Extract `jti` and remove id from vc
  if (credential.id) {
    payloadOptions.jti = credential.id
    // biome-ignore lint/performance/noDelete: <explanation>
    delete vc.id
  }

  if (Array.isArray(credential.credentialSubject) && credential.credentialSubject.length !== 1) {
    throw new CredoError('JWT VCs must have exactly one credential subject')
  }

  // Extract `sub` and remove credential subject id from vc
  const [credentialSubjectId] = credential.credentialSubjectIds
  if (credentialSubjectId) {
    payloadOptions.sub = credentialSubjectId

    if (Array.isArray(vc.credentialSubject)) {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete vc.credentialSubject[0].id
    } else {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete vc.credentialSubject?.id
    }
  }

  return new JwtPayload(payloadOptions)
}

export function getCredentialFromJwtPayload(jwtPayload: JwtPayload) {
  if (!('vc' in jwtPayload.additionalClaims) || !isJsonObject(jwtPayload.additionalClaims.vc)) {
    throw new CredoError("JWT does not contain a valid 'vc' claim")
  }

  const jwtVc = jwtPayload.additionalClaims.vc

  if (!jwtPayload.nbf || !jwtPayload.iss) {
    throw new CredoError("JWT does not contain valid 'nbf' and 'iss' claims")
  }

  if (Array.isArray(jwtVc.credentialSubject) && jwtVc.credentialSubject.length !== 1) {
    throw new CredoError('JWT VCs must have exactly one credential subject')
  }

  if (Array.isArray(jwtVc.credentialSubject) && !isObject(jwtVc.credentialSubject[0])) {
    throw new CredoError('JWT VCs must have a credential subject of type object')
  }

  const credentialSubject = Array.isArray(jwtVc.credentialSubject)
    ? jwtVc.credentialSubject[0]
    : jwtVc.credentialSubject
  if (!isJsonObject(credentialSubject)) {
    throw new CredoError('JWT VC does not have a valid credential subject')
  }
  const subjectWithId = jwtPayload.sub ? { ...credentialSubject, id: jwtPayload.sub } : credentialSubject

  // Validate vc.id and jti
  if (jwtVc.id && jwtPayload.jti !== jwtVc.id) {
    throw new CredoError('JWT jti and vc.id do not match')
  }

  // Validate vc.issuer and iss
  if (
    (typeof jwtVc.issuer === 'string' && jwtPayload.iss !== jwtVc.issuer) ||
    (isJsonObject(jwtVc.issuer) && jwtVc.issuer.id && jwtPayload.iss !== jwtVc.issuer.id)
  ) {
    throw new CredoError('JWT iss and vc.issuer(.id) do not match')
  }

  // Validate vc.issuanceDate and nbf
  if (jwtVc.issuanceDate) {
    if (typeof jwtVc.issuanceDate !== 'string') {
      throw new CredoError('JWT vc.issuanceDate must be a string')
    }

    const issuanceDate = Date.parse(jwtVc.issuanceDate) / 1000
    if (jwtPayload.nbf !== issuanceDate) {
      throw new CredoError('JWT nbf and vc.issuanceDate do not match')
    }
  }

  // Validate vc.expirationDate and exp
  if (jwtVc.expirationDate) {
    if (typeof jwtVc.expirationDate !== 'string') {
      throw new CredoError('JWT vc.expirationDate must be a string')
    }

    const expirationDate = Date.parse(jwtVc.expirationDate) / 1000
    if (expirationDate !== jwtPayload.exp) {
      throw new CredoError('JWT exp and vc.expirationDate do not match')
    }
  }

  // Validate vc.credentialSubject.id and sub
  if (
    (isJsonObject(jwtVc.credentialSubject) &&
      jwtVc.credentialSubject.id &&
      jwtPayload.sub !== jwtVc.credentialSubject.id) ||
    (Array.isArray(jwtVc.credentialSubject) &&
      isJsonObject(jwtVc.credentialSubject[0]) &&
      jwtVc.credentialSubject[0].id &&
      jwtPayload.sub !== jwtVc.credentialSubject[0].id)
  ) {
    throw new CredoError('JWT sub and vc.credentialSubject.id do not match')
  }

  // Create a verifiable credential structure that is compatible with the VC data model
  const dataModelVc = {
    ...jwtVc,
    issuanceDate: w3cDate(jwtPayload.nbf * 1000),
    expirationDate: jwtPayload.exp ? w3cDate(jwtPayload.exp * 1000) : undefined,
    issuer: typeof jwtVc.issuer === 'object' ? { ...jwtVc.issuer, id: jwtPayload.iss } : jwtPayload.iss,
    id: jwtPayload.jti,
    credentialSubject: Array.isArray(jwtVc.credentialSubject) ? [subjectWithId] : subjectWithId,
  }

  const vcInstance = JsonTransformer.fromJSON(dataModelVc, W3cCredential)

  return vcInstance
}
