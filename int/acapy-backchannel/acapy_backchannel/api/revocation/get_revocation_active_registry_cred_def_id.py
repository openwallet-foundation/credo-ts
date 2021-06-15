from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.rev_reg_result import RevRegResult
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    cred_def_id: str,
) -> Dict[str, Any]:
    url = "{}/revocation/active-registry/{cred_def_id}".format(client.base_url, cred_def_id=cred_def_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[RevRegResult]:
    if response.status_code == 200:
        response_200 = RevRegResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[RevRegResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    cred_def_id: str,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    cred_def_id: str,
) -> Optional[RevRegResult]:
    """ """

    return sync_detailed(
        client=client,
        cred_def_id=cred_def_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    cred_def_id: str,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    cred_def_id: str,
) -> Optional[RevRegResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            cred_def_id=cred_def_id,
        )
    ).parsed
