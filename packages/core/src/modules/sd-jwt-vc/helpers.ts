import { AgentContext } from '../../agent'
import { getDomainFromUrl } from '../../utils/domain'
import { DidResolverService, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { PublicJwk } from '../kms'
import { X509Certificate } from '../x509'
import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVcHolderBinding, SdJwtVcIssuer } from './SdJwtVcOptions'

async function resolveSigningPublicJwkFromDidUrl(agentContext: AgentContext, didUrl: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)

  const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
  return publicJwk
}

async function resolveDidUrl(agentContext: AgentContext, didUrl: string) {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
  const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

  return {
    verificationMethod: didDocument.dereferenceKey(didUrl, ['assertionMethod']),
    didDocument,
  }
}

function assertValidX5cJwtIssuer(agentContext: AgentContext, iss: string, leafCertificate: X509Certificate) {
  if (!iss.startsWith('https://') && !(iss.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)) {
    throw new SdJwtVcError('The X509 certificate issuer must be a HTTPS URI.')
  }

  if (!leafCertificate.sanUriNames?.includes(iss) && !leafCertificate.sanDnsNames?.includes(getDomainFromUrl(iss))) {
    throw new SdJwtVcError(
      `The 'iss' claim in the payload does not match a 'SAN-URI' name and the domain extracted from the HTTPS URI does not match a 'SAN-DNS' name in the x5c certificate.`
    )
  }
}

export async function extractKeyFromIssuer(agentContext: AgentContext, issuer: SdJwtVcIssuer, forSigning = false) {
  if (issuer.method === 'did') {
    const parsedDid = parseDid(issuer.didUrl)
    if (!parsedDid.fragment) {
      throw new SdJwtVcError(`didUrl '${issuer.didUrl}' does not contain a '#'. Unable to derive key from did document`)
    }

    let publicJwk: PublicJwk
    if (forSigning) {
      publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, issuer.didUrl)
    } else {
      const { verificationMethod } = await resolveDidUrl(agentContext, issuer.didUrl)
      publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    }

    const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
    if (supportedSignatureAlgorithms.length === 0) {
      throw new SdJwtVcError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`)
    }
    const alg = supportedSignatureAlgorithms[0]

    return {
      alg,
      publicJwk,
      iss: parsedDid.did,
      kid: `#${parsedDid.fragment}`,
    }
  }

  // FIXME: probably need to make the input an x509 certificate so we can attach a key id
  if (issuer.method === 'x5c') {
    const leafCertificate = issuer.x5c[0]
    if (!leafCertificate) {
      throw new SdJwtVcError("Empty 'x5c' array provided")
    }

    // TODO: We don't have an x509 certificate record so we expect the key id to already be set
    if (forSigning && !leafCertificate.publicJwk.hasKeyId) {
      throw new SdJwtVcError("Expected leaf certificate in 'x5c' array to have a key id configured.")
    }

    const publicJwk = leafCertificate.publicJwk
    const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
    if (supportedSignatureAlgorithms.length === 0) {
      throw new SdJwtVcError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`)
    }
    const alg = supportedSignatureAlgorithms[0]

    assertValidX5cJwtIssuer(agentContext, issuer.issuer, leafCertificate)

    return {
      publicJwk,
      iss: issuer.issuer,
      x5c: issuer.x5c,
      alg,
    }
  }

  throw new SdJwtVcError("Unsupported credential issuer. Only 'did' and 'x5c' is supported at the moment.")
}

export async function extractKeyFromHolderBinding(
  agentContext: AgentContext,
  holder: SdJwtVcHolderBinding,
  forSigning = false
) {
  if (holder.method === 'did') {
    const parsedDid = parseDid(holder.didUrl)
    if (!parsedDid.fragment) {
      throw new SdJwtVcError(`didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`)
    }

    let publicJwk: PublicJwk
    if (forSigning) {
      publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, holder.didUrl)
    } else {
      const { verificationMethod } = await resolveDidUrl(agentContext, holder.didUrl)
      publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    }

    const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
    if (supportedSignatureAlgorithms.length === 0) {
      throw new SdJwtVcError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`)
    }
    const alg = supportedSignatureAlgorithms[0]

    return {
      alg,
      publicJwk,
      cnf: {
        // We need to include the whole didUrl here, otherwise the verifier
        // won't know which did it is associated with
        kid: holder.didUrl,
      },
    }
  }
  if (holder.method === 'jwk') {
    const publicJwk = holder.jwk
    const alg = publicJwk.supportedSignatureAlgorithms[0]

    // If there is no key id configured when signing, we assume this credential was issued before we included key ids
    // and the we use the legacy key id.
    if (forSigning && !publicJwk.hasKeyId) {
      publicJwk.keyId = publicJwk.legacyKeyId
    }

    return {
      alg,
      publicJwk,
      cnf: {
        jwk: publicJwk.toJson(),
      },
    }
  }

  throw new SdJwtVcError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
}
