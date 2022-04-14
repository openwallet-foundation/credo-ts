/*
 * Copyright 2020 - MATTR Limited
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bls12381G2KeyPair } from "@mattrglobal/bls12381-key-pair";
import { KeyPairSigner } from "./KeyPairSigner";

/**
 * Options for constructing a signature suite
 */
export interface SignatureSuiteOptions {
  /**
   * An optional signer interface for handling the sign operation
   */
  readonly signer?: KeyPairSigner;
  /**
   * The key pair used to generate the proof
   */
  readonly key?: Bls12381G2KeyPair;
  /**
   * A key id URL to the paired public key used for verifying the proof
   */
  readonly verificationMethod?: string;
  /**
   * The `created` date to report in generated proofs
   */
  readonly date?: string | Date;
  /**
   * Indicates whether to use the native implementation
   * of RDF Dataset Normalization
   */
  readonly useNativeCanonize?: boolean;
  /**
   * Additional proof elements
   */
  readonly proof?: any;
  /**
   * Linked Data Key class implementation
   */
  readonly LDKeyClass?: any;
}
