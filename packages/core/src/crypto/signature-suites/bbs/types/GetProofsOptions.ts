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
/**
 * Options for getting a proof from a JSON-LD document
 */
export interface GetProofsOptions {
  /**
   * The JSON-LD document to extract the proofs from.
   */
  readonly document: any;
  /**
   * Optional the proof type(s) to filter the returned proofs by
   */
  readonly proofType?: string | readonly string[];
  /**
   * Optional custom document loader
   */
  documentLoader?(): any;
  /**
   * Optional expansion map
   */
  expansionMap?(): any;
  /**
   * Optional property to indicate whether to skip compacting the resulting proof
   */
  readonly skipProofCompaction?: boolean;
}
