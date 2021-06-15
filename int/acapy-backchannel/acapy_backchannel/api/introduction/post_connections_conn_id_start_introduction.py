from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.intro_module_response import IntroModuleResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    conn_id: str,
    target_connection_id: str,
    message: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/connections/{conn_id}/start-introduction".format(client.base_url, conn_id=conn_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "target_connection_id": target_connection_id,
        "message": message,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[IntroModuleResponse]:
    if response.status_code == 200:
        response_200 = IntroModuleResponse.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[IntroModuleResponse]:
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
    target_connection_id: str,
    message: Union[Unset, str] = UNSET,
) -> Response[IntroModuleResponse]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        target_connection_id=target_connection_id,
        message=message,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    conn_id: str,
    target_connection_id: str,
    message: Union[Unset, str] = UNSET,
) -> Optional[IntroModuleResponse]:
    """ """

    return sync_detailed(
        client=client,
        conn_id=conn_id,
        target_connection_id=target_connection_id,
        message=message,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    conn_id: str,
    target_connection_id: str,
    message: Union[Unset, str] = UNSET,
) -> Response[IntroModuleResponse]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        target_connection_id=target_connection_id,
        message=message,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    conn_id: str,
    target_connection_id: str,
    message: Union[Unset, str] = UNSET,
) -> Optional[IntroModuleResponse]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            conn_id=conn_id,
            target_connection_id=target_connection_id,
            message=message,
        )
    ).parsed
