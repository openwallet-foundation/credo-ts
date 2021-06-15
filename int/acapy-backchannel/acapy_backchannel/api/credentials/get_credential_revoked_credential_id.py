from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.cred_revoked_result import CredRevokedResult
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    credential_id: str,
    from_: Union[Unset, str] = UNSET,
    to: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/credential/revoked/{credential_id}".format(client.base_url, credential_id=credential_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "from": from_,
        "to": to,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[CredRevokedResult]:
    if response.status_code == 200:
        response_200 = CredRevokedResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[CredRevokedResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    credential_id: str,
    from_: Union[Unset, str] = UNSET,
    to: Union[Unset, str] = UNSET,
) -> Response[CredRevokedResult]:
    kwargs = _get_kwargs(
        client=client,
        credential_id=credential_id,
        from_=from_,
        to=to,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    credential_id: str,
    from_: Union[Unset, str] = UNSET,
    to: Union[Unset, str] = UNSET,
) -> Optional[CredRevokedResult]:
    """ """

    return sync_detailed(
        client=client,
        credential_id=credential_id,
        from_=from_,
        to=to,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    credential_id: str,
    from_: Union[Unset, str] = UNSET,
    to: Union[Unset, str] = UNSET,
) -> Response[CredRevokedResult]:
    kwargs = _get_kwargs(
        client=client,
        credential_id=credential_id,
        from_=from_,
        to=to,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    credential_id: str,
    from_: Union[Unset, str] = UNSET,
    to: Union[Unset, str] = UNSET,
) -> Optional[CredRevokedResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            credential_id=credential_id,
            from_=from_,
            to=to,
        )
    ).parsed
