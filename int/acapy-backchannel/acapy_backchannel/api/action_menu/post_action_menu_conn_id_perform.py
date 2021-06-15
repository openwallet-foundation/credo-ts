from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.action_menu_modules_result import ActionMenuModulesResult
from ...models.perform_request import PerformRequest
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    conn_id: str,
    json_body: PerformRequest,
) -> Dict[str, Any]:
    url = "{}/action-menu/{conn_id}/perform".format(client.base_url, conn_id=conn_id)

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


def _parse_response(*, response: httpx.Response) -> Optional[ActionMenuModulesResult]:
    if response.status_code == 200:
        response_200 = ActionMenuModulesResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[ActionMenuModulesResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    conn_id: str,
    json_body: PerformRequest,
) -> Response[ActionMenuModulesResult]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    conn_id: str,
    json_body: PerformRequest,
) -> Optional[ActionMenuModulesResult]:
    """ """

    return sync_detailed(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    conn_id: str,
    json_body: PerformRequest,
) -> Response[ActionMenuModulesResult]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    conn_id: str,
    json_body: PerformRequest,
) -> Optional[ActionMenuModulesResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            conn_id=conn_id,
            json_body=json_body,
        )
    ).parsed
