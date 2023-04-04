<h1 align="center"><b>Test tails file server</b></h1>

This is a very simple server that is used to host tails files during for tests suites where revocable credentials are issued and verified.

It offers a single endpoint at the root that takes an URI-encoded `tailsFileId` as URL path and allows to upload (using PUT method and a through a multi-part encoded form) or retrieve a tails file (using GET method).