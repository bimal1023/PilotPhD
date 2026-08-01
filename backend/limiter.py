from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def user_or_ip(request: Request) -> str:
    """Rate-limit key: the authenticated user when we can identify one.

    Keying purely on IP is wrong for this app on two counts. Behind Caddy every
    request arrives from the proxy's address, so a single bucket would be shared
    by everyone; and even with the real client address restored, users behind a
    shared NAT would exhaust each other's budget. Falls back to the address for
    anonymous endpoints (login, register, password reset), which is the correct
    key there since there is no user yet.
    """
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ")
    else:
        token = request.cookies.get("session")

    if token:
        try:
            # Imported lazily: auth imports config/database, and this module is
            # pulled in early by main.
            from .auth import decode_access_token

            user_id, _ = decode_access_token(token)
            return f"user:{user_id}"
        except Exception:
            pass

    return get_remote_address(request)


limiter = Limiter(key_func=user_or_ip)
