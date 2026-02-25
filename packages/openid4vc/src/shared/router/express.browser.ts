export function importExpress() {
  throw new Error(
    "Express cannot be imported in the browser. This is probably because you are trying to use the 'OpenId4VcIssuerModule' or the 'OpenId4VcVerifierModule'."
  )
}
