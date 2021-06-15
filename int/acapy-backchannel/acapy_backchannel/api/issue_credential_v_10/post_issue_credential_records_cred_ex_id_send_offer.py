from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.v10_credential_exchange import V10CredentialExchange
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    cred_ex_id: str,
) -> Dict[str, Any]:
    url = "{}/issue-credential/records/{cred_ex_id}/send-offer".format(client.base_url, cred_ex_id=cred_ex_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[V10CredentialExchange]:
    if response.status_code == 200:
        response_200 = V10CredentialExchange.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[V10CredentialExchange]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    cred_ex_id: str,
) -> Response[V10CredentialExchange]:
    kwargs = _get_kwargs(
        client=client,
        cred_ex_id=cred_ex_id,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    cred_ex_id: str,
) -> Optional[V10CredentialExchange]:
    """ """

    return sync_detailed(
        client=client,
        cred_ex_id=cred_ex_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    cred_ex_id: str,
) -> Response[V10CredentialExchange]:
    kwargs = _get_kwargs(
        client=client,
        cred_ex_id=cred_ex_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    cred_ex_id: str,
) -> Optional[V10CredentialExchange]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            cred_ex_id=cred_ex_id,
        )
    ).parsed
