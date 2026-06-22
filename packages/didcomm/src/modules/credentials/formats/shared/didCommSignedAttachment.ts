import type { AgentContext, JwsDetachedFormat } from "@credo-ts/core";
import {
  CredoError,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  JsonEncoder,
  JwsService,
  JwtPayload,
  Kms,
  parseDid,
  TypedArrayEncoder,
} from "@credo-ts/core";
import {
  DidCommAttachment,
  DidCommAttachmentData,
} from "../../../../decorators/attachment/DidCommAttachment";

/**
 * Creates a DIDComm signed attachment containing a JWS over the given data.
 * Used for binding proofs in credential request messages.
 */
export async function createDidCommSignedAttachment(
  agentContext: AgentContext,
  data: { nonce: string },
  options: { alg?: string; kid: string },
  issuerSupportedAlgs: string[],
): Promise<DidCommAttachment> {
  const { alg, kid } = options;

  if (!kid.startsWith("did:")) {
    throw new CredoError(
      `kid '${kid}' is not a DID. Only dids are supported for kid`,
    );
  }
  if (!kid.includes("#")) {
    throw new CredoError(
      `kid '${kid}' does not contain a fragment. kid MUST point to a specific key in the did document.`,
    );
  }

  const parsedDid = parseDid(kid);

  const didsApi = agentContext.dependencyManager.resolve(DidsApi);
  const { didDocument, keys } = await didsApi.resolveCreatedDidDocumentWithKeys(
    parsedDid.did,
  );
  const verificationMethod = didDocument.dereferenceKey(kid);

  const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod);
  const keyId =
    keys?.find(
      ({ didDocumentRelativeKeyId }) =>
        didDocumentRelativeKeyId === `#${parsedDid.fragment}`,
    )?.kmsKeyId ?? publicJwk.legacyKeyId;

  if (
    alg &&
    !publicJwk.supportedSignatureAlgorithms.includes(
      alg as Kms.KnownJwaSignatureAlgorithm,
    )
  ) {
    throw new CredoError(
      `jwk ${publicJwk.jwkTypeHumanDescription}, does not support the JWS signature alg '${alg}'`,
    );
  }

  const signingAlg = issuerSupportedAlgs.find(
    (supportedAlg) =>
      publicJwk.supportedSignatureAlgorithms.includes(
        supportedAlg as Kms.KnownJwaSignatureAlgorithm,
      ) &&
      (alg === undefined || alg === supportedAlg),
  );
  if (!signingAlg)
    throw new CredoError("No signing algorithm supported by the issuer found");

  const jwsService = agentContext.dependencyManager.resolve(JwsService);
  const jws = await jwsService.createJws(agentContext, {
    keyId,
    header: {},
    payload: new JwtPayload({ additionalClaims: { nonce: data.nonce } }),
    protectedHeaderOptions: {
      alg: signingAlg as Kms.KnownJwaSignatureAlgorithm,
      kid,
    },
  });

  const signedAttach = new DidCommAttachment({
    mimeType: "application/json",
    data: new DidCommAttachmentData({
      base64: TypedArrayEncoder.toBase64(
        TypedArrayEncoder.fromBase64Url(jws.payload),
      ),
    }),
  });

  signedAttach.addJws(jws);

  return signedAttach;
}

/**
 * Verifies a DIDComm signed attachment and returns the payload.
 * Used by issuers to verify binding proofs in credential requests.
 */
export async function verifyDidCommSignedAttachment(
  agentContext: AgentContext,
  signedAttachment: DidCommAttachment,
): Promise<{ nonce: string; kid: string }> {
  const jws = signedAttachment.data.jws as JwsDetachedFormat;
  if (!jws) throw new CredoError("Missing jws in signed attachment");
  if (!jws.protected)
    throw new CredoError("Missing protected header in signed attachment");
  if (!signedAttachment.data.base64)
    throw new CredoError("Missing payload in signed attachment");

  let resolvedKid: string | undefined;

  const jwsService = agentContext.dependencyManager.resolve(JwsService);
  const { isValid } = await jwsService.verifyJws(agentContext, {
    jws: {
      header: jws.header,
      protected: jws.protected,
      signature: jws.signature,
      payload: TypedArrayEncoder.toBase64Url(
        TypedArrayEncoder.fromBase64(signedAttachment.data.base64),
      ),
    },
    allowedJwsSignerMethods: ["did"],
    resolveJwsSigner: async ({ protectedHeader: { kid, alg } }) => {
      if (!kid || typeof kid !== "string")
        throw new CredoError("Missing kid in protected header.");
      if (!kid.startsWith("did:"))
        throw new CredoError("Only did is supported for kid identifier");

      resolvedKid = kid;

      const didsApi = agentContext.dependencyManager.resolve(DidsApi);
      const didDocument = await didsApi.resolveDidDocument(kid);
      const verificationMethod = didDocument.dereferenceKey(kid);
      const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod);

      return {
        alg,
        method: "did",
        didUrl: kid,
        jwk: publicJwk,
      };
    },
  });

  if (!isValid)
    throw new CredoError("Failed to validate signature of signed attachment");

  const payload = JsonEncoder.fromBase64(signedAttachment.data.base64) as {
    nonce: string;
  };
  if (!payload.nonce || typeof payload.nonce !== "string") {
    throw new CredoError("Invalid payload in signed attachment");
  }

  if (!resolvedKid)
    throw new CredoError("Could not resolve kid from signed attachment");

  return { nonce: payload.nonce, kid: resolvedKid };
}
