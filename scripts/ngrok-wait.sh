#!/bin/bash

NGROK_NAME=${NGROK_NAME:-ngrok}

echo "ngrok end point [$NGROK_NAME]"

ENDPOINT=null
while [ -z "$ENDPOINT" ] || [ "$ENDPOINT" = "null" ]; do
    echo "Fetching end point from ngrok service"
    ENDPOINT=$(curl -s $NGROK_NAME:4040/api/tunnels/command_line | grep -o "https:\/\/.*\.ngrok\.io")

    if [ -z "$ENDPOINT" ] || [ "$ENDPOINT" = "null" ]; then
        echo "ngrok not ready, sleeping 5 seconds...."
        sleep 5
    fi
done

echo "fetched end point [$ENDPOINT]"

export AGENT_ENDPOINT=$ENDPOINT
exec "$@"