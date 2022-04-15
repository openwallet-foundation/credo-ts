import { frame } from '@digitalcredentials/jsonld'

import { BBS_V1, EXAMPLES_V1, ODRL, SCHEMA_ORG, VACCINATION_V1 } from './contexts'
import { CITIZENSHIP_V1 } from './contexts/citizenship_v1'
import { CREDENTIALS_V1 } from './contexts/credentials_v1'
import { DID_V1 } from './contexts/did_v1'
import { SECURITY_V1 } from './contexts/security_v1'
import { SECURITY_V2 } from './contexts/security_v2'
import { SECURITY_V3_UNSTABLE } from './contexts/security_v3_unstable'
import { DID_EXAMPLE_48939859 } from './dids/did_example_489398593'
import { DID_SOV_QqEfJxe752NCmWqR5TssZ5 } from './dids/did_sov_QqEfJxe752NCmWqR5TssZ5'
import { DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL } from './dids/did_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
import { DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV } from './dids/did_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV'
import { DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa } from './dids/did_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa'

export const DOCUMENTS = {
  [DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL['id']]: DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL,
  [DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV['id']]: DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV,
  [DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa[
    'id'
  ]]: DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa,
  [DID_EXAMPLE_48939859['id']]: DID_EXAMPLE_48939859,
  [DID_SOV_QqEfJxe752NCmWqR5TssZ5['id']]: DID_SOV_QqEfJxe752NCmWqR5TssZ5,
  SECURITY_CONTEXT_V1_URL: SECURITY_V1,
  SECURITY_CONTEXT_V2_URL: SECURITY_V2,
  SECURITY_CONTEXT_V3_URL: SECURITY_V3_UNSTABLE,
  DID_V1_CONTEXT_URL: DID_V1,
  CREDENTIALS_CONTEXT_V1_URL: CREDENTIALS_V1,
  SECURITY_CONTEXT_BBS_URL: BBS_V1,
  'https://www.w3.org/2018/credentials/examples/v1': EXAMPLES_V1,
  'https://www.w3.org/2018/credentials/v1': CREDENTIALS_V1,
  'https://w3id.org/citizenship/v1': CITIZENSHIP_V1,
  'https://www.w3.org/ns/odrl.jsonld': ODRL,
  'http://schema.org/': SCHEMA_ORG,
  'https://w3id.org/vaccination/v1': VACCINATION_V1,
}

export const customDocumentLoader = async (url: string): Promise<Record<string, any>> => {
  if (url.startsWith('did:')) {
    let didDoc = DOCUMENTS[url]

    if (!didDoc) {
      const withoutFragment = url.split('#')[0]
      didDoc = DOCUMENTS[withoutFragment]
    }

    if (!didDoc) {
      throw new Error(`Document not found: ${url}`)
    }

    const framed = await frame(didDoc, {
      '@context': didDoc['@context'],
      '@embed': '@never',
      id: url,
    })

    return {
      // contextUrl: result.didDocument.context[0],
      contextUrl: null,
      documentUrl: url,
      document: framed,
    }
  }

  // Check if full url (with fragments is in document map)
  if (url in DOCUMENTS) {
    return {
      contentType: 'application/ld+json',
      contextUrl: null,
      document: DOCUMENTS[url],
      documentUrl: url,
    }
  }

  // Otherwise look if it is present without fragment
  const withoutFragment = url.split('#')[0]
  if (withoutFragment in DOCUMENTS) {
    return {
      contentType: 'application/ld+json',
      contextUrl: null,
      document: DOCUMENTS[withoutFragment],
      documentUrl: url,
    }
  }

  throw new Error(`No custom context support for ${url}`)
}
