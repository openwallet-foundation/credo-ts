/*
 * The code in this file originated from
 * @see https://github.com/digitalbazaar/jsonld-signatures
 * Hence the following copyright notice applies
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SECURITY_CONTEXT_URL } from "jsonld-signatures";
import jsonld from "jsonld";
import { GetProofsOptions, GetProofsResult, GetTypeOptions } from "./types";

/**
 * The property identifying the linked data proof
 * Note - this will not work for legacy systems that
 * relying on `signature`
 */
const PROOF_PROPERTY = "proof";

/**
 * Gets a supported linked data proof from a JSON-LD Document
 * Note - unless instructed not to the document will be compacted
 * against the security v2 context @see https://w3id.org/security/v2
 *
 * @param options Options for extracting the proof from the document
 *
 * @returns {GetProofsResult} An object containing the matched proofs and the JSON-LD document
 */
export const getProofs = async (
  options: GetProofsOptions
): Promise<GetProofsResult> => {
  const {
    proofType,
    skipProofCompaction,
    documentLoader,
    expansionMap
  } = options;
  let { document } = options;

  let proofs;
  if (!skipProofCompaction) {
    // If we must compact the proof then we must first compact the input
    // document to find the proof
    document = await jsonld.compact(document, SECURITY_CONTEXT_URL, {
      documentLoader,
      expansionMap,
      compactToRelative: false
    });
  }

  proofs = jsonld.getValues(document, PROOF_PROPERTY);
  delete document[PROOF_PROPERTY];

  if (typeof proofType === "string") {
    proofs = proofs.filter((_: any) => _.type == proofType);
  }
  if (Array.isArray(proofType)) {
    proofs = proofs.filter((_: any) => proofType.includes(_.type));
  }

  proofs = proofs.map((matchedProof: any) => ({
    "@context": SECURITY_CONTEXT_URL,
    ...matchedProof
  }));

  return {
    proofs,
    document
  };
};

/**
 * Formats an input date to w3c standard date format
 * @param date {number|string} Optional if not defined current date is returned
 *
 * @returns {string} date in a standard format as a string
 */
export const w3cDate = (date?: number | string): string => {
  let result = new Date();
  if (typeof date === "number" || typeof date === "string") {
    result = new Date(date);
  }
  const str = result.toISOString();
  return str.substr(0, str.length - 5) + "Z";
};

/**
 * Gets the JSON-LD type information for a document
 * @param document {any} JSON-LD document to extract the type information from
 * @param options {GetTypeInfoOptions} Options for extracting the JSON-LD document
 *
 * @returns {object} Type info for the JSON-LD document
 */
export const getTypeInfo = async (
  document: any,
  options: GetTypeOptions
): Promise<any> => {
  const { documentLoader, expansionMap } = options;

  // determine `@type` alias, if any
  const context = jsonld.getValues(document, "@context");

  const compacted = await jsonld.compact({ "@type": "_:b0" }, context, {
    documentLoader,
    expansionMap
  });

  delete compacted["@context"];

  const alias = Object.keys(compacted)[0];

  // optimize: expand only `@type` and `type` values
  /* eslint-disable prefer-const */
  let toExpand: any = { "@context": context };
  toExpand["@type"] = jsonld
    .getValues(document, "@type")
    .concat(jsonld.getValues(document, alias));

  const expanded =
    (await jsonld.expand(toExpand, { documentLoader, expansionMap }))[0] || {};

  return { types: jsonld.getValues(expanded, "@type"), alias };
};
