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

import type { DocumentLoader, JsonObject, Proof, ProofPurpose } from '@credo-ts/core'

/**
 * Options for verifying a proof
 */
export interface VerifyProofOptions {
  /**
   * The proof
   */
  readonly proof: Proof
  /**
   * The document
   */
  readonly document: JsonObject
  /**
   * The proof purpose to specify for the generated proof
   */
  readonly purpose: ProofPurpose
  /**
   * Optional custom document loader
   */
  documentLoader?: DocumentLoader
}
