import type { DidRepository } from "@credo-ts/core";
import {
  AgentContext,
  DidResolverService,
  DidsModuleConfig,
  InjectionSymbols,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  W3cV2CredentialService,
  W3cV2SdJwtVerifiableCredential,
  X509ModuleConfig,
} from "@credo-ts/core";
import { Subject } from "rxjs";
import { InMemoryStorageService } from "../../../tests/InMemoryStorageService";
import type { CreateDidKidVerificationMethodReturn } from "../../core/tests";
import {
  agentDependencies,
  createDidKidVerificationMethod,
  getAgentConfig,
  getAgentContext,
  testLogger,
} from "../../core/tests";
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialRole,
  DidCommCredentialState,
} from "../src";
import { DidCommW3cV2SdJwtCredentialFormatService } from "../src/modules/credentials/formats/w3cV2SdJwt/DidCommW3cV2SdJwtCredentialFormatService";

const agentConfig = getAgentConfig("W3cV2SdJwt format service test");
const inMemoryStorageService = new InMemoryStorageService();

const didsModuleConfig = new DidsModuleConfig({
  registrars: [new KeyDidRegistrar()],
  resolvers: [new KeyDidResolver()],
});

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, new agentDependencies.FileSystem()],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, didsModuleConfig],
    [
      DidResolverService,
      new DidResolverService(
        testLogger,
        didsModuleConfig,
        {} as unknown as DidRepository,
      ),
    ],
    [X509ModuleConfig, new X509ModuleConfig()],
  ],
  agentConfig,
});

agentContext.dependencyManager.registerInstance(AgentContext, agentContext);

const formatService = new DidCommW3cV2SdJwtCredentialFormatService();

describe("W3C VCDM 2.0 SD-JWT credential format service", () => {
  let issuerKdv: CreateDidKidVerificationMethodReturn;
  let holderKdv: CreateDidKidVerificationMethodReturn;

  beforeAll(async () => {
    issuerKdv = await createDidKidVerificationMethod(
      agentContext,
      "96213c3d7fc8d4d6754c7a0fd969598g",
    );
    holderKdv = await createDidKidVerificationMethod(
      agentContext,
      "96213c3d7fc8d4d6754c7a0fd969598f",
    );
  });

  test("issuance flow without binding (bearer credential)", async () => {
    await issuanceFlowTest({ issuerKdv, holderKdv, bindingRequired: false });
  });

  test("issuance flow with didcomm_signed_attachment binding", async () => {
    await issuanceFlowTest({ issuerKdv, holderKdv, bindingRequired: true });
  });
});

async function issuanceFlowTest(options: {
  issuerKdv: CreateDidKidVerificationMethodReturn;
  holderKdv: CreateDidKidVerificationMethodReturn;
  bindingRequired: boolean;
}) {
  const { issuerKdv: issuer, holderKdv: holder, bindingRequired } = options;

  const holderCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: "v2",
    state: DidCommCredentialState.OfferReceived,
    threadId: "f365c1a5-2baf-4873-9432-fa87c888a0aa",
    role: DidCommCredentialRole.Holder,
  });

  const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: "v2",
    state: DidCommCredentialState.OfferSent,
    threadId: "f365c1a5-2baf-4873-9432-fa87c888a0aa",
    role: DidCommCredentialRole.Issuer,
  });

  const credentialJson = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential"],
    issuer: issuer.did,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: holder.did,
      name: "John",
      age: "25",
    },
  };

  // --- Issuer creates offer ---
  const { attachment: offerAttachment } = await formatService.createOffer(
    agentContext,
    {
      credentialExchangeRecord: issuerCredentialRecord,
      credentialFormats: {
        w3cV2SdJwt: {
          credential: credentialJson,
          bindingRequired,
          ...(bindingRequired && {
            didCommSignedAttachmentBinding: {
              algsSupported: ["EdDSA"],
              didMethodsSupported: ["key"],
            },
          }),
        },
      },
    },
  );

  // --- Holder processes offer ---
  await formatService.processOffer(agentContext, {
    credentialExchangeRecord: holderCredentialRecord,
    attachment: offerAttachment,
  });

  // --- Holder accepts offer ---
  const {
    attachment: requestAttachment,
    appendAttachments: requestAppendAttachments,
  } = await formatService.acceptOffer(agentContext, {
    credentialExchangeRecord: holderCredentialRecord,
    offerAttachment,
    credentialFormats: bindingRequired
      ? { w3cV2SdJwt: { didCommSignedAttachment: { kid: holder.kid } } }
      : { w3cV2SdJwt: {} },
  });

  // --- Issuer processes request ---
  await formatService.processRequest(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    attachment: requestAttachment,
  });

  // --- Issuer accepts request (issues credential) ---
  const { attachment: credentialAttachment } =
    await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      requestAppendAttachments,
      credentialFormats: {
        w3cV2SdJwt: {
          alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
        },
      },
    });

  // --- Holder processes credential ---
  await formatService.processCredential(agentContext, {
    offerAttachment,
    credentialExchangeRecord: holderCredentialRecord,
    attachment: credentialAttachment,
    requestAttachment,
  });

  // --- Assertions ---
  expect(holderCredentialRecord.credentials).toEqual([
    { credentialRecordType: "w3c-v2", credentialRecordId: expect.any(String) },
  ]);

  const credentialRecordId =
    holderCredentialRecord.credentials[0].credentialRecordId;
  const w3cV2CredentialService = agentContext.dependencyManager.resolve(
    W3cV2CredentialService,
  );
  const storedRecord = await w3cV2CredentialService.getCredentialRecordById(
    agentContext,
    credentialRecordId,
  );

  expect(storedRecord).toBeDefined();
  expect(storedRecord.firstCredential.resolvedCredential.type).toContain(
    "VerifiableCredential",
  );

  if (bindingRequired) {
    const credential = storedRecord.firstCredential;
    expect(credential).toBeInstanceOf(W3cV2SdJwtVerifiableCredential);
    if (credential instanceof W3cV2SdJwtVerifiableCredential) {
      expect(credential.sdJwt.prettyClaims.cnf).toBeDefined();
    }
  }
}
