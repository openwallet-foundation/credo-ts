import { W3cV2DataIntegrityVerifiableCredential, W3cV2DataIntegrityVerifiablePresentation } from '../data-integrity-v1'
import { CredoDidKeyDiVc, CredoDidKeyDiVp } from '../data-integrity-v1/__tests__/fixtures/credo-di-vc'
import { W3cV2JwtVerifiablePresentation } from '../jwt-vc'
import { CredoEs256DidJwkJwtVc, CredoEs256DidKeyJwtVp } from '../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2EnvelopedVerifiableCredential } from '../models/credential/W3cV2EnvelopedVerifiableCredential'
import { W3cV2EnvelopedVerifiablePresentation } from '../models/presentation/W3cV2EnvelopedVerifiablePresentation'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import { W3cV2SdJwtVerifiablePresentation } from '../sd-jwt-vc'
import {
  CredoEs256DidJwkJwtVc as CredoEs256DidJwkSdJwtVc,
  CredoEs256DidKeyJwtVp as CredoEs256DidKeySdJwtVp,
} from '../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'

/**
 * Canonical VC2 mixed VP fixture module.
 *
 * Design goals:
 * - Keep fixture composition human-readable.
 * - Keep the file small by composing from three static credential blocks.
 * - Encode per-test cryptographic leaf material (id/nonce/enveloped IDs)
 *   without duplicating full credential payload trees.
 */

// -----------------------------------------------------------------------------
// 1) Mutable metadata template (id and nonce vary per fixture)
// -----------------------------------------------------------------------------

type MutableVpMetadata = {
  id: string
  nonce: string
}

const baseVpMetadata = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiablePresentation'],
  holder: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
} as const

const mutableMetadataTemplate: MutableVpMetadata = {
  id: 'urn:vp:replace-id',
  nonce: 'replace-nonce',
}

// -----------------------------------------------------------------------------
// 2) Static JWT enveloped VC
// 3) Static SD-JWT enveloped VC
// 4) Static DI VC
// -----------------------------------------------------------------------------

export const staticJwtCredential = {
  __proto__: W3cV2EnvelopedVerifiableCredential.prototype,
  '@context': 'https://www.w3.org/ns/credentials/v2',
  id: `data:application/vc+jwt,${CredoEs256DidJwkJwtVc}`,
  type: 'EnvelopedVerifiableCredential',
} as const

export const staticSdJwtCredential = {
  __proto__: W3cV2EnvelopedVerifiableCredential.prototype,
  '@context': 'https://www.w3.org/ns/credentials/v2',
  id: `data:application/vc+sd-jwt,${CredoEs256DidJwkSdJwtVc}`,
  type: 'EnvelopedVerifiableCredential',
} as const

export const staticDiCredential = {
  __proto__: W3cV2DataIntegrityVerifiableCredential.prototype,
  securedCredential: CredoDidKeyDiVc,
} as const

type OuterMechanism = 'jwt' | 'sd-jwt' | 'di'

type MatrixInnerKind = 'vc-jwt' | 'vc-sd-jwt' | 'vc-di' | 'nested-vp-jwt' | 'nested-vp-sd-jwt' | 'nested-vp-di'

type EncodedLeafMaterial = {
  vpId: string
  nonce: string
  outerEncoded: string
  nestedEncoded?: string
}

function withPresentationPrototype<T extends object>(value: T): T {
  Object.setPrototypeOf(value, W3cV2Presentation.prototype)
  return value
}

function buildResolvedPresentation(entries: ReadonlyArray<unknown>, mutable: MutableVpMetadata) {
  return withPresentationPrototype({
    ...baseVpMetadata,
    id: mutable.id,
    nonce: mutable.nonce,
    verifiableCredential: entries,
  })
}

function buildOuterJwtVp(entries: ReadonlyArray<unknown>, mutable: MutableVpMetadata) {
  return {
    __proto__: W3cV2JwtVerifiablePresentation.prototype,
    resolvedPresentation: buildResolvedPresentation(entries, mutable),
  } as const
}

function buildOuterSdJwtVp(entries: ReadonlyArray<unknown>, mutable: MutableVpMetadata) {
  return {
    __proto__: W3cV2SdJwtVerifiablePresentation.prototype,
    resolvedPresentation: buildResolvedPresentation(entries, mutable),
  } as const
}

function buildOuterDiVp(entries: ReadonlyArray<unknown>, mutable: MutableVpMetadata) {
  return {
    __proto__: W3cV2DataIntegrityVerifiablePresentation.prototype,
    securedPresentation: CredoDidKeyDiVp,
    resolvedPresentation: buildResolvedPresentation(entries, mutable),
  } as const
}

const nestedJwtVpEntry = {
  __proto__: W3cV2EnvelopedVerifiablePresentation.prototype,
  id: `data:application/vp+jwt,${CredoEs256DidKeyJwtVp}`,
} as const

const nestedSdJwtVpEntry = {
  __proto__: W3cV2EnvelopedVerifiablePresentation.prototype,
  id: `data:application/vp+sd-jwt,${CredoEs256DidKeySdJwtVp}`,
} as const

const nestedDiVpEmbeddedEntry = {
  __proto__: W3cV2DataIntegrityVerifiablePresentation.prototype,
  securedPresentation: CredoDidKeyDiVp,
  resolvedPresentation: buildResolvedPresentation([staticDiCredential], {
    ...mutableMetadataTemplate,
    id: CredoDidKeyDiVp.id,
    nonce: 'nonce-nested-di-vp-leaf',
  }),
} as const

function buildFixture(
  name: string,
  outer: OuterMechanism,
  inner: MatrixInnerKind,
  entries: ReadonlyArray<unknown>,
  encoded: EncodedLeafMaterial
) {
  const mutable: MutableVpMetadata = {
    id: encoded.vpId,
    nonce: encoded.nonce,
  }

  const presentation =
    outer === 'jwt'
      ? buildOuterJwtVp(entries, mutable)
      : outer === 'sd-jwt'
        ? buildOuterSdJwtVp(entries, mutable)
        : buildOuterDiVp(entries, mutable)

  return {
    name,
    outer,
    inner,
    encoded,
    presentation,
  } as const
}

// -----------------------------------------------------------------------------
// 18 matrix fixtures: 3 outer x 6 inner
// NOTE: outerEncoded/nestedEncoded are generated static cryptographic leaf values.
// -----------------------------------------------------------------------------

const fixture_outerJwt_innerJwtVc = buildFixture('outerJwt_innerJwtVc', 'jwt', 'vc-jwt', [staticJwtCredential], {
  vpId: 'urn:fixture:outer-jwt-inner-jwt-vc',
  nonce: 'nonce-outer-jwt-inner-jwt-vc',
  outerEncoded:
    'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9qd3RfdmMiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiI5MWNiZDY1MmM4M2YxODU1MjUyZmJmNjYiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.OTFjYmQ2NTJjODNmMTg1NTI1MmZiZjY2MWU5MmQ1MWFkYjM3MzNkYTE1NGMzMGEwMmY2MzJlNWIyNDI2MWNlZg',
})

const fixture_outerJwt_innerSdJwtVc = buildFixture(
  'outerJwt_innerSdJwtVc',
  'jwt',
  'vc-sd-jwt',
  [staticSdJwtCredential],
  {
    vpId: 'urn:fixture:outer-jwt-inner-sd-jwt-vc',
    nonce: 'nonce-outer-jwt-inner-sd-jwt-vc',
    outerEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9zZF9qd3RfdmMiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiJjOGY1ZWMwZmVmYTAzOWU0Y2I3MjBkNDMiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.YzhmNWVjMGZlZmEwMzllNGNiNzIwZDQzM2E0ZTFhZjY2ZWNlY2RmYTcwNWQ2YmNhNzMwY2Q0ZTViNDVhODc4Zg',
  }
)

const fixture_outerJwt_innerDiVc = buildFixture('outerJwt_innerDiVc', 'jwt', 'vc-di', [staticDiCredential], {
  vpId: 'urn:fixture:outer-jwt-inner-di-vc',
  nonce: 'nonce-outer-jwt-inner-di-vc',
  outerEncoded:
    'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9kaV92YyIsImlhdCI6MTczNTY4OTYwMCwibmJmIjoxNzM1Njg5NjAwLCJub25jZSI6Ijg2NDIzZmIzMGQzYzJjNTRmMDRjNDQwZiIsImlzcyI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2Iiwic3ViIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYifQ.ODY0MjNmYjMwZDNjMmM1NGYwNGM0NDBmYTg4YzM2YjhjNjE5M2ZmZmM2NDNjYjA3N2M3YTM5MjkxNzU3ODk1Nw',
})

const fixture_outerJwt_innerNestedJwtVp = buildFixture(
  'outerJwt_innerNestedJwtVp',
  'jwt',
  'nested-vp-jwt',
  [nestedJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-jwt-inner-nested-jwt-vp',
    nonce: 'nonce-outer-jwt-inner-nested-jwt-vp',
    outerEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9uZXN0ZWRfand0X3ZwIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiODk3OWZmMjM4ZmI4ZWJiMjJhYzU3NmU3IiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.ODk3OWZmMjM4ZmI4ZWJiMjJhYzU3NmU3MjNmZjI5NzI5ZTM1OTkzYjBmMjA1YzIxZTk5MTMzZTdiMjUxZjVmZA',
    nestedEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9qd3RfdnBfand0X291dGVyIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiNTBjNTNhZTBlNmE3YzdjZGQ5MTMyYjQ0IiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.NTBjNTNhZTBlNmE3YzdjZGQ5MTMyYjQ0ZGM0ZTk2NWUxOGZmMzg2NjdiZTFjYzRhODNhNzIwYmEzZTY4NGUxMw',
  }
)

const fixture_outerJwt_innerNestedSdJwtVp = buildFixture(
  'outerJwt_innerNestedSdJwtVp',
  'jwt',
  'nested-vp-sd-jwt',
  [nestedSdJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-jwt-inner-nested-sd-jwt-vp',
    nonce: 'nonce-outer-jwt-inner-nested-sd-jwt-vp',
    outerEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9uZXN0ZWRfc2Rfand0X3ZwIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiYjUyOGIzMTlkODgyZmVjMGQwM2MwNjgzIiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.YjUyOGIzMTlkODgyZmVjMGQwM2MwNjgzNTQ1MGViMmI0OWNhMjJmNGQwMmJjMWMyZTg5MWM0N2NmYWY1NjE2Yw',
    nestedEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9zZF9qd3RfdnBfand0X291dGVyIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiNjdjYTQ2YTRmMGYzYjJjMDg3NmY3YTEwIiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.NjdjYTQ2YTRmMGYzYjJjMDg3NmY3YTEwODMyMTEyYWQ1MzJiYzJkYzlkMzJkMDNkOGVmZGU3MmRjMjM0MmE0OA~WyJub25jZSIsIjY3Y2E0NmE0ZjBmMyJd~',
  }
)

const fixture_outerSdJwt_innerJwtVc = buildFixture('outerSdJwt_innerJwtVc', 'sd-jwt', 'vc-jwt', [staticJwtCredential], {
  vpId: 'urn:fixture:outer-sd-jwt-inner-jwt-vc',
  nonce: 'nonce-outer-sd-jwt-inner-jwt-vc',
  outerEncoded:
    'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9qd3RfdmMiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiIzYTY2OGZjMTc5YjViZjk5MWZiODRiNDkiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.M2E2NjhmYzE3OWI1YmY5OTFmYjg0YjQ5M2U5MjUxYTM1ZmQzZWFiMDBiNDhkZGQ4YzQxMzJlMDc0NWZlZDA0Zg~WyJub25jZSIsIjNhNjY4ZmMxNzliNSJd~',
})

const fixture_outerSdJwt_innerSdJwtVc = buildFixture(
  'outerSdJwt_innerSdJwtVc',
  'sd-jwt',
  'vc-sd-jwt',
  [staticSdJwtCredential],
  {
    vpId: 'urn:fixture:outer-sd-jwt-inner-sd-jwt-vc',
    nonce: 'nonce-outer-sd-jwt-inner-sd-jwt-vc',
    outerEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9zZF9qd3RfdmMiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiI4YzJmN2YxYThkZWMwMmI3Y2YyNWNlM2EiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.OGMyZjdmMWE4ZGVjMDJiN2NmMjVjZTNhMzY4N2M5ZTExYTgyMjU0MGIzZTA3OTZhMjY0ZWMwNmUzZTUyM2ZjOQ~WyJub25jZSIsIjhjMmY3ZjFhOGRlYyJd~',
  }
)

const fixture_outerSdJwt_innerDiVc = buildFixture('outerSdJwt_innerDiVc', 'sd-jwt', 'vc-di', [staticDiCredential], {
  vpId: 'urn:fixture:outer-sd-jwt-inner-di-vc',
  nonce: 'nonce-outer-sd-jwt-inner-di-vc',
  outerEncoded:
    'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9kaV92YyIsImlhdCI6MTczNTY4OTYwMCwibmJmIjoxNzM1Njg5NjAwLCJub25jZSI6ImVlODg0YTdiYzdlOGZhZDczZTY2YTg2OSIsImlzcyI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2Iiwic3ViIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYifQ.ZWU4ODRhN2JjN2U4ZmFkNzNlNjZhODY5OTNhY2MwOTkzNTU5MmI0MzIwMWIwOGM0Yzc0OTUxM2JiNzZiYjk5Zg~WyJub25jZSIsImVlODg0YTdiYzdlOCJd~',
})

const fixture_outerSdJwt_innerNestedJwtVp = buildFixture(
  'outerSdJwt_innerNestedJwtVp',
  'sd-jwt',
  'nested-vp-jwt',
  [nestedJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-sd-jwt-inner-nested-jwt-vp',
    nonce: 'nonce-outer-sd-jwt-inner-nested-jwt-vp',
    outerEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9uZXN0ZWRfand0X3ZwIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiNTI4OGEyY2VkNjFkNDc1YzkzNjMwOTNjIiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.NTI4OGEyY2VkNjFkNDc1YzkzNjMwOTNjYzYxY2FkNzdjYWI0YjkwYTFiZWM4OWVhMzc0OTM0ODE2ZTRmOThhYQ~WyJub25jZSIsIjUyODhhMmNlZDYxZCJd~',
    nestedEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9qd3RfdnBfc2Rfand0X291dGVyIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiYzVhNGQxZTI2ZjE4N2NhN2FmOWVlM2I5IiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.YzVhNGQxZTI2ZjE4N2NhN2FmOWVlM2I5MjRiMDcwZTUwMTQ1M2Y1ZjIyYzZkMThkZmUwMzJkMDkwMGQ3OWY1OA',
  }
)

const fixture_outerSdJwt_innerNestedSdJwtVp = buildFixture(
  'outerSdJwt_innerNestedSdJwtVp',
  'sd-jwt',
  'nested-vp-sd-jwt',
  [nestedSdJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-sd-jwt-inner-nested-sd-jwt-vp',
    nonce: 'nonce-outer-sd-jwt-inner-nested-sd-jwt-vp',
    outerEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9uZXN0ZWRfc2Rfand0X3ZwIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiNTllYzc3OGQ0MTcwNWQ3YzhhZDQxM2U3IiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.NTllYzc3OGQ0MTcwNWQ3YzhhZDQxM2U3YjI0OTVjNGM5NmEwZjUxY2VmYWIxOTQ2MDczYzY0MTk5ZTlkMGJhYQ~WyJub25jZSIsIjU5ZWM3NzhkNDE3MCJd~',
    nestedEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9zZF9qd3RfdnBfc2Rfand0X291dGVyIiwiaWF0IjoxNzM1Njg5NjAwLCJuYmYiOjE3MzU2ODk2MDAsIm5vbmNlIjoiNmJlZjQ0OWJjYmZlZDNjZmMyYWU3NjdhIiwiaXNzIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJzdWIiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9.NmJlZjQ0OWJjYmZlZDNjZmMyYWU3NjdhYTU3MDEzNDA4OTJjYzk2OWI4ZjBkMTY3YjljMTljYmVmMmE0NzEzNg~WyJub25jZSIsIjZiZWY0NDliY2JmZSJd~',
  }
)

const fixture_outerDi_innerJwtVc = buildFixture('outerDi_innerJwtVc', 'di', 'vc-jwt', [staticJwtCredential], {
  vpId: 'urn:fixture:outer-di-inner-jwt-vc',
  nonce: 'nonce-outer-di-inner-jwt-vc',
  outerEncoded: JSON.stringify(CredoDidKeyDiVp),
})

const fixture_outerDi_innerSdJwtVc = buildFixture('outerDi_innerSdJwtVc', 'di', 'vc-sd-jwt', [staticSdJwtCredential], {
  vpId: 'urn:fixture:outer-di-inner-sd-jwt-vc',
  nonce: 'nonce-outer-di-inner-sd-jwt-vc',
  outerEncoded: JSON.stringify(CredoDidKeyDiVp),
})

const fixture_outerDi_innerDiVc = buildFixture('outerDi_innerDiVc', 'di', 'vc-di', [staticDiCredential], {
  vpId: 'urn:fixture:outer-di-inner-di-vc',
  nonce: 'nonce-outer-di-inner-di-vc',
  outerEncoded: JSON.stringify(CredoDidKeyDiVp),
})

const fixture_outerDi_innerNestedJwtVp = buildFixture(
  'outerDi_innerNestedJwtVp',
  'di',
  'nested-vp-jwt',
  [nestedJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-di-inner-nested-jwt-vp',
    nonce: 'nonce-outer-di-inner-nested-jwt-vp',
    outerEncoded: JSON.stringify(CredoDidKeyDiVp),
    nestedEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9qd3RfdnBfZGlfb3V0ZXIiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiIwN2Q3MTE5YjY0YzdhNzE2OTM1MjY5N2IiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.MDdkNzExOWI2NGM3YTcxNjkzNTI2OTdiOGE2NjI0NDk0MTBjMWEzN2YyNzY2ZTllNDgwOTBkYmVkYWUzNWQwOQ',
  }
)

const fixture_outerDi_innerNestedSdJwtVp = buildFixture(
  'outerDi_innerNestedSdJwtVp',
  'di',
  'nested-vp-sd-jwt',
  [nestedSdJwtVpEntry],
  {
    vpId: 'urn:fixture:outer-di-inner-nested-sd-jwt-vp',
    nonce: 'nonce-outer-di-inner-nested-sd-jwt-vp',
    outerEncoded: JSON.stringify(CredoDidKeyDiVp),
    nestedEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX25lc3RlZF9zZF9qd3RfdnBfZGlfb3V0ZXIiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiIyNTJjZDcxNWY2YmM5M2FiMzUzMjY1ODMiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.MjUyY2Q3MTVmNmJjOTNhYjM1MzI2NTgzNTk3YmM0MTIxNTk0YzNmYmM1ZTg4ZTliMjdjYWY5ZTA3NWYxNWM1Yw~WyJub25jZSIsIjI1MmNkNzE1ZjZiYyJd~',
  }
)

const fixture_outerJwt_innerNestedDiVp = buildFixture(
  'outerJwt_innerNestedDiVp',
  'jwt',
  'nested-vp-di',
  [nestedDiVpEmbeddedEntry],
  {
    vpId: 'urn:fixture:outer-jwt-inner-nested-di-vp',
    nonce: 'nonce-outer-jwt-inner-nested-di-vp',
    outerEncoded:
      'data:application/vp+jwt,eyJ0eXAiOiJ2cCtqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX2p3dF9pbm5lcl9uZXN0ZWRfZGlfdnAiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiI3OGY5ZDAxMTA1Njk4OWE0MjgwODdhNGQiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.NzhmOWQwMTEwNTY5ODlhNDI4MDg3YTRkYWVjNDFkOTljYjRjMmM0MDAxYTIyNmQxMzRjMTdhMzhhYWUxODczMg',
    nestedEncoded: JSON.stringify(CredoDidKeyDiVp),
  }
)

const fixture_outerSdJwt_innerNestedDiVp = buildFixture(
  'outerSdJwt_innerNestedDiVp',
  'sd-jwt',
  'nested-vp-di',
  [nestedDiVpEmbeddedEntry],
  {
    vpId: 'urn:fixture:outer-sd-jwt-inner-nested-di-vp',
    nonce: 'nonce-outer-sd-jwt-inner-nested-di-vp',
    outerEncoded:
      'data:application/vp+sd-jwt,eyJ0eXAiOiJ2cCtzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.eyJqdGkiOiJ1cm46Zml4dHVyZTpyZXBsYWNlX291dGVyX3NkX2p3dF9pbm5lcl9uZXN0ZWRfZGlfdnAiLCJpYXQiOjE3MzU2ODk2MDAsIm5iZiI6MTczNTY4OTYwMCwibm9uY2UiOiI0Y2Q5YmFkNjhkMWE2ODFkYjM3ZDlhOWMiLCJpc3MiOiJkaWQ6a2V5Ono2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiIsInN1YiI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0.NGNkOWJhZDY4ZDFhNjgxZGIzN2Q5YTljYmMwMWQ3ZjNmNWExMmUxMWE0ZDdhNjE2MTdmZjFkNzVkY2I2NDJlOA~WyJub25jZSIsIjRjZDliYWQ2OGQxYSJd~',
    nestedEncoded: JSON.stringify(CredoDidKeyDiVp),
  }
)

const fixture_outerDi_innerNestedDiVp = buildFixture(
  'outerDi_innerNestedDiVp',
  'di',
  'nested-vp-di',
  [nestedDiVpEmbeddedEntry],
  {
    vpId: 'urn:fixture:outer-di-inner-nested-di-vp',
    nonce: 'nonce-outer-di-inner-nested-di-vp',
    outerEncoded: JSON.stringify(CredoDidKeyDiVp),
    nestedEncoded: JSON.stringify(CredoDidKeyDiVp),
  }
)

// Named records for ergonomic lookups in tests.
export const vpMatrixFixtureByName = {
  outerJwt_innerJwtVc: fixture_outerJwt_innerJwtVc,
  outerJwt_innerSdJwtVc: fixture_outerJwt_innerSdJwtVc,
  outerJwt_innerDiVc: fixture_outerJwt_innerDiVc,
  outerJwt_innerNestedJwtVp: fixture_outerJwt_innerNestedJwtVp,
  outerJwt_innerNestedSdJwtVp: fixture_outerJwt_innerNestedSdJwtVp,
  outerJwt_innerNestedDiVp: fixture_outerJwt_innerNestedDiVp,
  outerSdJwt_innerJwtVc: fixture_outerSdJwt_innerJwtVc,
  outerSdJwt_innerSdJwtVc: fixture_outerSdJwt_innerSdJwtVc,
  outerSdJwt_innerDiVc: fixture_outerSdJwt_innerDiVc,
  outerSdJwt_innerNestedJwtVp: fixture_outerSdJwt_innerNestedJwtVp,
  outerSdJwt_innerNestedSdJwtVp: fixture_outerSdJwt_innerNestedSdJwtVp,
  outerSdJwt_innerNestedDiVp: fixture_outerSdJwt_innerNestedDiVp,
  outerDi_innerJwtVc: fixture_outerDi_innerJwtVc,
  outerDi_innerSdJwtVc: fixture_outerDi_innerSdJwtVc,
  outerDi_innerDiVc: fixture_outerDi_innerDiVc,
  outerDi_innerNestedJwtVp: fixture_outerDi_innerNestedJwtVp,
  outerDi_innerNestedSdJwtVp: fixture_outerDi_innerNestedSdJwtVp,
  outerDi_innerNestedDiVp: fixture_outerDi_innerNestedDiVp,
} as const
