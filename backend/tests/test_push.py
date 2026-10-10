"""Web Push: VAPID-signed, encrypted delivery that a browser can decrypt."""

import base64
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace

import http_ece
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from src.services import push


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_vapid_key_is_stable_p256_point():
    key = push.public_key_b64()
    assert key == push.public_key_b64()
    raw = base64.urlsafe_b64decode(key + "=" * (-len(key) % 4))
    assert len(raw) == 65 and raw[0] == 0x04


def test_send_one_delivers_decryptable_payload():
    received: dict = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            body = self.rfile.read(int(self.headers["Content-Length"]))
            received.update(headers=dict(self.headers), body=body)
            self.send_response(201)
            self.end_headers()

        def log_message(self, *_a):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.handle_request, daemon=True).start()

    # The "browser" side of the subscription
    ua_key = ec.generate_private_key(ec.SECP256R1())
    ua_pub = ua_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    auth = b"0123456789abcdef"
    sub = SimpleNamespace(
        endpoint=f"http://127.0.0.1:{server.server_port}/push",
        p256dh=_b64(ua_pub),
        auth=_b64(auth),
    )
    payload = json.dumps({"title": "בדיקה", "body": "שלום"}, ensure_ascii=False)

    status = push._send_one(sub, payload)
    server.server_close()

    assert status == 201
    headers = {k.lower(): v for k, v in received["headers"].items()}
    assert headers["authorization"].lower().startswith(("vapid ", "webpush ")), headers
    plain = http_ece.decrypt(received["body"], private_key=ua_key, auth_secret=auth, version="aes128gcm")
    assert json.loads(plain.decode())["title"] == "בדיקה"
