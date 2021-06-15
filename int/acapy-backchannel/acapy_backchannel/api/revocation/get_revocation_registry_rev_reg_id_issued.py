from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.rev_reg_issued_result import RevRegIssuedResult
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    rev_reg_id: str,
) -> Dict[str, Any]:
    url = "{}/revocation/registry/{rev_reg_id}/issued".format(client.base_url, rev_reg_id=rev_reg_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[RevRegIssuedResult]:
    if response.status_code == 200:
        response_200 = RevRegIssuedResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[RevRegIssuedResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    rev_reg_id: str,
) -> Response[RevRegIssuedResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    rev_reg_id: str,
) -> Optional[RevRegIssuedResult]:
    """ """

    return sync_detailed(
        client=client,
        rev_reg_id=rev_reg_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    rev_reg_id: str,
) -> Response[RevRegIssuedResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    rev_reg_id: str,
) -> Optional[RevRegIssuedResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            rev_reg_id=rev_reg_id,
        )
    ).parsed
