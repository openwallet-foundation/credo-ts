from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.rev_reg_result import RevRegResult
from ...models.rev_reg_update_tails_file_uri import RevRegUpdateTailsFileUri
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    rev_reg_id: str,
    json_body: RevRegUpdateTailsFileUri,
) -> Dict[str, Any]:
    url = "{}/revocation/registry/{rev_reg_id}".format(client.base_url, rev_reg_id=rev_reg_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_json_body = json_body.to_dict()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "json": json_json_body,
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
    rev_reg_id: str,
    json_body: RevRegUpdateTailsFileUri,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
        json_body=json_body,
    )

    response = httpx.patch(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    rev_reg_id: str,
    json_body: RevRegUpdateTailsFileUri,
) -> Optional[RevRegResult]:
    """ """

    return sync_detailed(
        client=client,
        rev_reg_id=rev_reg_id,
        json_body=json_body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    rev_reg_id: str,
    json_body: RevRegUpdateTailsFileUri,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
        json_body=json_body,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.patch(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    rev_reg_id: str,
    json_body: RevRegUpdateTailsFileUri,
) -> Optional[RevRegResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            rev_reg_id=rev_reg_id,
            json_body=json_body,
        )
    ).parsed
