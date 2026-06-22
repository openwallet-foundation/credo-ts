import type { AgentContext } from "@credo-ts/core";
import {
  ClaimFormat,
  CredoError,
  DidsApi,
  JsonEncoder,
  JsonTransformer,
  Kms,
  parseDid,
  TypedArrayEncoder,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2CredentialService,
  W3cV2SdJwtVerifiableCredential,
} from "@credo-ts/core";
import {
  DidCommAttachment,
  DidCommAttachmentData,
} from "../../../../decorators/attachment/DidCommAttachment";
import { DidCommCredentialFormatSpec } from "../../models/DidCommCredentialFormatSpec";
import type { DidCommCredentialFormatService } from "../DidCommCredentialFormatService";
import type {
  DidCommCredentialFormatAcceptOfferOptions,
  DidCommCredentialFormatAcceptProposalOptions,
  DidCommCredentialFormatAcceptRequestOptions,
  DidCommCredentialFormatAutoRespondCredentialOptions,
  DidCommCredentialFormatAutoRespondOfferOptions,
  DidCommCredentialFormatAutoRespondProposalOptions,
  DidCommCredentialFormatAutoRespondRequestOptions,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatCreateOfferReturn,
  DidCommCredentialFormatCreateProposalOptions,
  DidCommCredentialFormatCreateProposalReturn,
  DidCommCredentialFormatCreateRequestOptions,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
} from "../DidCommCredentialFormatServiceOptions";
import {
  createDidCommSignedAttachment,
  verifyDidCommSignedAttachment,
} from "../shared/didCommSignedAttachment";
import type { DidCommW3cV2SdJwtCredentialFormat } from "./DidCommW3cV2SdJwtCredentialFormat";
import {
  W3cV2SdJwtBindingMethod,
  W3cV2SdJwtCredentialOffer,
  W3cV2SdJwtDidCommSignedAttachmentBindingMethod,
  type W3cV2SdJwtCredentialIssue,
  type W3cV2SdJwtCredentialRequest,
} from "./w3cV2SdJwtExchange";

const W3C_V2_SD_JWT_OFFER = "didcomm/vc+sd-jwt-offer@v1.0";
const W3C_V2_SD_JWT_REQUEST = "didcomm/vc+sd-jwt-request@v1.0";
const W3C_V2_SD_JWT_CREDENTIAL = "didcomm/vc+sd-jwt@v1.0";

export class DidCommW3cV2SdJwtCredentialFormatService implements DidCommCredentialFormatService<DidCommW3cV2SdJwtCredentialFormat> {
  public readonly formatKey = "w3cV2SdJwt" as const;
  public readonly credentialRecordType = "w3c-v2" as const;

  public async createProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateProposalOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    throw new CredoError(
      "Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format",
    );
  }

  public async processProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatProcessOptions,
  ) {
    throw new CredoError(
      "Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format",
    );
  }

  public async acceptProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAcceptProposalOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    throw new CredoError(
      "Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format",
    );
  }

  public async createOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      attachmentId,
    }: DidCommCredentialFormatCreateOfferOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    const w3cV2SdJwtFormat = credentialFormats.w3cV2SdJwt;
    if (!w3cV2SdJwtFormat)
      throw new CredoError("Missing w3cV2SdJwt credential format data");

    const { credential, bindingRequired, didCommSignedAttachmentBinding } =
      w3cV2SdJwtFormat;

    const credentialJson =
      credential instanceof W3cV2Credential
        ? JsonTransformer.toJSON(credential)
        : credential;

    if ("proof" in credentialJson)
      throw new CredoError(
        "The offered credential MUST NOT contain any proofs.",
      );

    // Validate credential as VCDM 2.0 (with offer exceptions: issuer/validFrom can be missing)
    const credentialToValidate = {
      ...credentialJson,
      issuer: credentialJson.issuer ?? "https://placeholder.com",
      validFrom: credentialJson.validFrom ?? new Date().toISOString(),
    };
    JsonTransformer.fromJSON(credentialToValidate, W3cV2Credential);

    // Build binding method if required
    let bindingMethod: W3cV2SdJwtCredentialOffer["bindingMethod"];
    if (bindingRequired) {
      if (!didCommSignedAttachmentBinding) {
        throw new CredoError(
          "Missing didCommSignedAttachmentBinding when bindingRequired is true",
        );
      }

      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi);
      const didsApi = agentContext.dependencyManager.resolve(DidsApi);

      const algsSupported =
        didCommSignedAttachmentBinding.algsSupported ??
        this.getSupportedJwaSignatureAlgorithms(agentContext);
      const didMethodsSupported =
        didCommSignedAttachmentBinding.didMethodsSupported ??
        didsApi.supportedResolverMethods;

      if (algsSupported.length === 0)
        throw new CredoError("No supported JWA signature algorithms found.");
      if (didMethodsSupported.length === 0)
        throw new CredoError("No supported DID methods found.");

      bindingMethod = new W3cV2SdJwtBindingMethod({
        didcommSignedAttachment:
          new W3cV2SdJwtDidCommSignedAttachmentBindingMethod({
            algsSupported,
            didMethodsSupported,
            nonce: TypedArrayEncoder.toBase64Url(
              kms.randomBytes({ length: 32 }),
            ),
          }),
      });
    }

    const credentialOffer = new W3cV2SdJwtCredentialOffer({
      bindingRequired,
      bindingMethod,
      credential: credentialJson,
    });

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_OFFER,
    });

    const attachment = this.getFormatData(
      JsonTransformer.toJSON(credentialOffer),
      format.attachmentId,
    );
    return { format, attachment };
  }

  public async processOffer(
    _agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions,
  ): Promise<void> {
    const credentialOffer = JsonTransformer.fromJSON(
      attachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );

    // Validate the credential in the offer (with exceptions)
    const credentialJson = credentialOffer.credential;
    const credentialToValidate = {
      ...credentialJson,
      issuer: credentialJson.issuer ?? "https://placeholder.com",
      validFrom: credentialJson.validFrom ?? new Date().toISOString(),
    };
    JsonTransformer.fromJSON(credentialToValidate, W3cV2Credential);

    if (
      credentialOffer.bindingRequired &&
      !credentialOffer.bindingMethod?.didcommSignedAttachment
    ) {
      throw new CredoError(
        "Invalid credential offer. Missing binding method when binding_required is true.",
      );
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      offerAttachment,
      attachmentId,
      credentialFormats,
    }: DidCommCredentialFormatAcceptOfferOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const credentialOffer = JsonTransformer.fromJSON(
      offerAttachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );

    let signedAttachment: DidCommAttachment | undefined;
    let bindingProof: W3cV2SdJwtCredentialRequest["binding_proof"];

    if (credentialOffer.bindingRequired) {
      const didCommSignedAttachmentOptions =
        credentialFormats?.w3cV2SdJwt?.didCommSignedAttachment;
      if (!didCommSignedAttachmentOptions) {
        throw new CredoError(
          "Missing didCommSignedAttachment options when accepting offer with binding_required",
        );
      }

      if (!credentialOffer.bindingMethod?.didcommSignedAttachment) {
        throw new CredoError(
          "Cannot request credential with a binding method that was not offered.",
        );
      }

      signedAttachment = await createDidCommSignedAttachment(
        agentContext,
        { nonce: credentialOffer.bindingMethod.didcommSignedAttachment.nonce },
        didCommSignedAttachmentOptions,
        credentialOffer.bindingMethod.didcommSignedAttachment.algsSupported,
      );

      bindingProof = {
        didcomm_signed_attachment: { attachment_id: signedAttachment.id },
      };
    }

    const credentialRequest: W3cV2SdJwtCredentialRequest = {
      binding_proof: bindingProof,
    };

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_REQUEST,
    });

    const attachment = this.getFormatData(
      credentialRequest,
      format.attachmentId,
    );
    return {
      format,
      attachment,
      appendAttachments: signedAttachment ? [signedAttachment] : undefined,
    };
  }

  public async createRequest(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateRequestOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateReturn> {
    throw new CredoError(
      "Starting from a request is not supported for W3C VCDM 2.0 SD-JWT credentials",
    );
  }

  public async processRequest(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatProcessOptions,
  ): Promise<void> {
    // Validation is done in acceptRequest on the issuer side
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      attachmentId,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    }: DidCommCredentialFormatAcceptRequestOptions<DidCommW3cV2SdJwtCredentialFormat>,
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const w3cV2SdJwtFormat = credentialFormats?.w3cV2SdJwt;

    if (!offerAttachment) throw new CredoError("Missing offer attachment");
    const credentialOffer = JsonTransformer.fromJSON(
      offerAttachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );
    const credentialRequest =
      requestAttachment.getDataAsJson<W3cV2SdJwtCredentialRequest>();

    // Resolve holder binding from signed attachment
    let holderBinding = w3cV2SdJwtFormat?.holderBinding;
    if (credentialRequest.binding_proof?.didcomm_signed_attachment) {
      if (!credentialOffer.bindingMethod?.didcommSignedAttachment) {
        throw new CredoError(
          "Cannot issue credential with a binding method that was not offered",
        );
      }

      const bindingProofAttachment = requestAppendAttachments?.find(
        (a) =>
          a.id ===
          credentialRequest.binding_proof?.didcomm_signed_attachment
            ?.attachment_id,
      );
      if (!bindingProofAttachment)
        throw new CredoError("Missing binding proof attachment");

      const { nonce, kid } = await verifyDidCommSignedAttachment(
        agentContext,
        bindingProofAttachment,
      );
      if (
        nonce !== credentialOffer.bindingMethod.didcommSignedAttachment.nonce
      ) {
        throw new CredoError("Invalid nonce in signed attachment");
      }

      // Validate kid DID method against offer constraints
      const parsedKidDid = parseDid(kid);
      if (
        !credentialOffer.bindingMethod.didcommSignedAttachment.didMethodsSupported.includes(
          parsedKidDid.method,
        )
      ) {
        throw new CredoError(
          `DID method '${parsedKidDid.method}' is not supported by the issuer`,
        );
      }

      // Derive holder binding from kid if not explicitly provided
      if (!holderBinding) {
        holderBinding = { method: "did", didUrl: kid };
      }
    } else if (credentialOffer.bindingRequired) {
      throw new CredoError(
        "Binding is required but no binding proof was provided",
      );
    }

    // Sign the credential
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(
      W3cV2CredentialService,
    );
    const credential = JsonTransformer.fromJSON(
      credentialOffer.credential,
      W3cV2Credential,
    );

    // Determine verification method
    let verificationMethod = w3cV2SdJwtFormat?.verificationMethod;
    if (!verificationMethod) {
      const didsApi = agentContext.dependencyManager.resolve(DidsApi);
      const issuerDid =
        typeof credential.issuer === "string"
          ? credential.issuer
          : credential.issuer.id;
      const didDocument = await didsApi.resolveDidDocument(issuerDid);
      const vms =
        didDocument.assertionMethod ??
        didDocument.authentication ??
        didDocument.verificationMethod;
      if (!vms || vms.length === 0) {
        throw new CredoError("No verification method found for issuer DID");
      }
      verificationMethod = typeof vms[0] === "string" ? vms[0] : vms[0].id;
    }

    // Determine signing algorithm
    const alg =
      w3cV2SdJwtFormat?.alg ??
      this.getSupportedJwaSignatureAlgorithms(agentContext)[0];
    if (!alg) throw new CredoError("No supported signing algorithm found");

    const verifiableCredential = await w3cV2CredentialService.signCredential(
      agentContext,
      {
        format: ClaimFormat.SdJwtW3cVc,
        credential,
        verificationMethod,
        alg,
        holder: holderBinding,
        disclosureFrame: w3cV2SdJwtFormat?.disclosureFrame,
      },
    );

    const credentialIssue: W3cV2SdJwtCredentialIssue = {
      credential: verifiableCredential.encoded as string,
    };

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_CREDENTIAL,
    });

    const attachment = new DidCommAttachment({
      id: format.attachmentId,
      mimeType: "application/json",
      data: new DidCommAttachmentData({
        base64: JsonEncoder.toBase64(credentialIssue),
      }),
    });

    return { format, attachment };
  }

  public async processCredential(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachment,
      offerAttachment,
    }: DidCommCredentialFormatProcessCredentialOptions,
  ): Promise<void> {
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(
      W3cV2CredentialService,
    );

    const { credential: compactSdJwt } =
      attachment.getDataAsJson<W3cV2SdJwtCredentialIssue>();
    if (!compactSdJwt)
      throw new CredoError("Missing credential in credential attachment");

    // Parse and validate
    const verifiableCredential =
      W3cV2SdJwtVerifiableCredential.fromCompact(compactSdJwt);

    // Verify signature
    const result = await w3cV2CredentialService.verifyCredential(agentContext, {
      credential: verifiableCredential,
    });
    if (!result.isValid) {
      throw new CredoError(
        `Failed to verify W3C VCDM 2.0 SD-JWT credential: ${result.error}`,
      );
    }

    // Validate credential matches offer
    const credentialOffer = JsonTransformer.fromJSON(
      offerAttachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );
    this.verifyCredentialMatchesOffer(verifiableCredential, credentialOffer);

    // Store credential
    const record = await w3cV2CredentialService.storeCredential(agentContext, {
      record: W3cV2CredentialRecord.fromCredential(verifiableCredential),
    });

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: record.id,
    });
  }

  private verifyCredentialMatchesOffer(
    credential: W3cV2SdJwtVerifiableCredential,
    offer: W3cV2SdJwtCredentialOffer,
  ): void {
    const resolvedCredential = credential.resolvedCredential;
    const offeredTypes = offer.credential.type as string[] | undefined;

    // Verify types match
    if (offeredTypes && offeredTypes.length > 0) {
      const credentialTypes = Array.isArray(resolvedCredential.type)
        ? resolvedCredential.type
        : [resolvedCredential.type];
      for (const offeredType of offeredTypes) {
        if (!credentialTypes.includes(offeredType)) {
          throw new CredoError(
            `Received credential is missing type '${offeredType}' from offer`,
          );
        }
      }
    }

    // Verify binding (cnf) if binding was required
    if (offer.bindingRequired) {
      const cnf = credential.sdJwt.prettyClaims.cnf;
      if (!cnf) {
        throw new CredoError(
          "Credential is missing cnf claim but binding was required",
        );
      }
    }
  }

  public supportsFormat(format: string): boolean {
    return [
      W3C_V2_SD_JWT_OFFER,
      W3C_V2_SD_JWT_REQUEST,
      W3C_V2_SD_JWT_CREDENTIAL,
    ].includes(format);
  }

  public async deleteCredentialById(
    agentContext: AgentContext,
    credentialRecordId: string,
  ): Promise<void> {
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(
      W3cV2CredentialService,
    );
    await w3cV2CredentialService.removeCredentialRecord(
      agentContext,
      credentialRecordId,
    );
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAutoRespondProposalOptions,
  ): Promise<boolean> {
    throw new CredoError(
      "Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format",
    );
  }

  public async shouldAutoRespondToOffer(
    _agentContext: AgentContext,
    { offerAttachment }: DidCommCredentialFormatAutoRespondOfferOptions,
  ): Promise<boolean> {
    const credentialOffer = JsonTransformer.fromJSON(
      offerAttachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );
    return !credentialOffer.bindingRequired;
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    {
      offerAttachment,
      requestAttachment,
    }: DidCommCredentialFormatAutoRespondRequestOptions,
  ): Promise<boolean> {
    const credentialOffer = JsonTransformer.fromJSON(
      offerAttachment.getDataAsJson(),
      W3cV2SdJwtCredentialOffer,
    );
    const credentialRequest =
      requestAttachment.getDataAsJson<W3cV2SdJwtCredentialRequest>();

    if (
      !credentialOffer.bindingRequired &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      return true;
    }

    if (
      credentialOffer.bindingRequired &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      return false;
    }

    // If binding was provided and offered, can auto-respond
    return Boolean(
      credentialRequest.binding_proof?.didcomm_signed_attachment &&
      credentialOffer.bindingMethod?.didcommSignedAttachment,
    );
  }

  public async shouldAutoRespondToCredential(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAutoRespondCredentialOptions,
  ): Promise<boolean> {
    return true;
  }

  private getFormatData(data: unknown, id: string): DidCommAttachment {
    return new DidCommAttachment({
      id,
      mimeType: "application/json",
      data: new DidCommAttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    });
  }

  private getSupportedJwaSignatureAlgorithms(
    agentContext: AgentContext,
  ): Kms.KnownJwaSignatureAlgorithm[] {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi);
    return Object.values(Kms.KnownJwaSignatureAlgorithms).filter(
      (algorithm) =>
        kms.supportedBackendsForOperation({
          operation: "sign",
          algorithm,
        }).length > 0,
    );
  }
}
