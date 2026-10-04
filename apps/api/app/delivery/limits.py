"""Reject oversized proof-of-delivery uploads before the JSON body is buffered and parsed."""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Base64 of a 1,000,000-byte photo plus JSON fields; larger bodies cannot be valid.
MAX_POD_REQUEST_BYTES = 1_500_000


class _TooLarge(Exception):
    pass


class PodBodyLimitMiddleware:
    def __init__(self, app: ASGIApp, limit: int = MAX_POD_REQUEST_BYTES) -> None:
        self.app = app
        self.limit = limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not (
            scope["type"] == "http"
            and scope["method"] == "POST"
            and str(scope["path"]).endswith("/pod")
        ):
            await self.app(scope, receive, send)
            return
        for name, value in scope["headers"]:
            if name == b"content-length" and (not value.isdigit() or int(value) > self.limit):
                await self._reject(send)
                return
        received = 0
        started = False

        async def limited() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.limit:
                    raise _TooLarge
            return message

        async def tracking(message: Message) -> None:
            nonlocal started
            started = started or message["type"] == "http.response.start"
            await send(message)

        try:
            await self.app(scope, limited, tracking)
        except _TooLarge:
            if not started:
                await self._reject(send)

    @staticmethod
    async def _reject(send: Send) -> None:
        body = json.dumps({"detail": "Proof-of-delivery request is too large"}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"cache-control", b"no-store"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
