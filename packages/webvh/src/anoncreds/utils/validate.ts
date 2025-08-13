import type { AgentContext, DataIntegrityProof, VerificationMethod } from '@credo-ts/core'

export function validateResource() { }

export function isValidProof(proof: DataIntegrityProof) {
    // Type check the proof object
    if (!proof || typeof proof !== 'object') {
        return 'Invalid proof: proof must be an object in did:webvh resource proof'
    }

    // Validate proof structure for DataIntegrityProof
    if (!proof.type || proof.type !== 'DataIntegrityProof') {
        return `Unsupported type: ${proof.type} in did:webvh resource proof`
    }

    if (!proof.cryptosuite || proof.cryptosuite !== 'eddsa-jcs-2022') {
        return `Unsupported cryptosuite: ${proof.cryptosuite} in did:webvh resource proof`
    }

    if (!proof.proofValue || proof.proofPurpose !== 'assertionMethod') {
        return 'Invalid proofPurpose in did:webvh resource proof'
    }

    if (!proof.verificationMethod || typeof proof.verificationMethod !== 'string') {
        return 'Invalid verificationMethod in did:webvh resource proof'
    }

    if (!proof.proofValue || typeof proof.proofValue !== 'string') {
        return 'Invalid proofValue in did:webvh resource proof'
    }

    return true
}

