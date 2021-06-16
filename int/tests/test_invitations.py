"""Example tests."""
import pytest

from acapy_backchannel import Client
from acapy_backchannel.api.connection import delete_connection, get_connections


async def clear_invitations(client: Client):
    """Clear all invitations, if any."""
    connections = await get_connections.asyncio(client=client)
    for connection in connections.results:
        if connection.state == "invitation":
            await delete_connection.asyncio(
                client=client, conn_id=connection.connection_id
            )


@pytest.fixture(autouse=True)
async def clear_invitation_state(backchannel: Client):
    """Clear invitations after each test."""
    # We don't need to do any setup tasks for this fixture.
    # Normally we would do some setup to create a value and then yield it for
    # use in the test method. This fixture is special in that it doesn't require
    # that setup and does not need to yield a value for use in a test method.
    # Just need to clear state that may have been triggered by the test method.

    yield

    # Everything that follows the yield is executed after the test method and
    # is where we perform tear down.

    await clear_invitations(backchannel)


@pytest.mark.asyncio
async def test_create_invitation(connection):
    reply = await connection.send_and_await_reply_async(
        {
            "@type": "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/create",
            "alias": "Invitation I sent to Alice",
            "label": "Bob",
            "group": "admin",
            "auto_accept": True,
            "multi_use": True,
        },
        return_route="all",
    )
    assert (
        reply["@type"]
        == "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/invitation"
    )


@pytest.mark.asyncio
async def test_get_list(connection):
    reply = await connection.send_and_await_reply_async(
        {
            "@type": "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/get-list"
        },
        return_route="all",
    )
    assert (
        reply["@type"]
        == "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/list"
    )


@pytest.mark.asyncio
async def test_num_results(connection):
    # Input number of messages to add to the list
    added_num = 3 
    # Add new messages
    for i in range(added_num):
        await connection.send_and_await_reply_async(
            {
                "@type": "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/create",
                "alias": "Message I sent to Alice",
                "label": "Bob",
                "group": "admin",
                "auto_accept": True,
                "multi_use": True,
            },
            return_route="all",
        )
    # Retrieve results of invitations list to verify that create message causes new item in results list
    reply = await connection.send_and_await_reply_async(
        {
            "@type": "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/get-list"
        },
        return_route="all",
    )
    assert len(reply["results"]) == added_num


@pytest.mark.asyncio
async def test_empty_list(connection):
    reply = await connection.send_and_await_reply_async(
        {
            "@type": "https://github.com/hyperledger/aries-toolbox/tree/master/docs/admin-invitations/0.1/get-list"
        },
        return_route="all",
    )
    assert reply["results"] == []
