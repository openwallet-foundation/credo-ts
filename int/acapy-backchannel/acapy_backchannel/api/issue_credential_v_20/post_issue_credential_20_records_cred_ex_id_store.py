from typing import Any, Dict

import httpx

from ...client import Client
from ...models.v20_cred_store_request import V20CredStoreRequest
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    cred_ex_id: str,
    json_body: V20CredStoreRequest,
) -> Dict[str, Any]:
    url = "{}/issue-credential-2.0/records/{cred_ex_id}/store".format(client.base_url, cred_ex_id=cred_ex_id)

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


def _build_response(*, response: httpx.Response) -> Response[None]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=None,
    )


def sync_detailed(
    *,
    client: Client,
    cred_ex_id: str,
    json_body: V20CredStoreRequest,
) -> Response[None]:
    kwargs = _get_kwargs(
        client=client,
        cred_ex_id=cred_ex_id,
        json_body=json_body,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


async def asyncio_detailed(
    *,
    client: Client,
    cred_ex_id: str,
    json_body: V20CredStoreRequest,
) -> Response[None]:
    kwargs = _get_kwargs(
        client=client,
        cred_ex_id=cred_ex_id,
        json_body=json_body,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)
