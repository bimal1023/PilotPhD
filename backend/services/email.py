import httpx
import logging
from ..config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"PilotPhD <{settings.from_email}>",
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            if not response.is_success:
                logger.error("Resend API error %s — from=%s to=%s — %s",
                             response.status_code, settings.from_email, to, response.text)
                raise RuntimeError(f"Email delivery failed ({response.status_code})")
    except RuntimeError:
        raise
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        raise RuntimeError("Email delivery failed — check the backend container logs")


def _email_wrapper(title: str, body: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2563eb;width:28px;height:28px;border-radius:6px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:14px;font-weight:700;line-height:28px;">P</span>
                  </td>
                  <td style="padding-left:10px;font-size:15px;font-weight:600;color:#111827;">PilotPhD</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;letter-spacing:-0.02em;">{title}</h1>
              {body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f4f6;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this email because you have a PilotPhD account.
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


async def send_verification_email(to: str, name: str, token: str) -> None:
    verify_url = f"{settings.frontend_base_url}/verify-email?token={token}"
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Hi {name}, welcome to PilotPhD! Please verify your email address to activate your account.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#2563eb;border-radius:8px;">
            <a href="{verify_url}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Verify email address
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Or copy this link into your browser:<br/>
        <span style="color:#2563eb;word-break:break-all;">{verify_url}</span>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">This link expires in 24 hours.</p>
    """
    await send_email(to, "Verify your PilotPhD email", _email_wrapper("Confirm your email", body))


async def send_password_reset_email(to: str, name: str, token: str) -> None:
    reset_url = f"{settings.frontend_base_url}/reset-password?token={token}"
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Hi {name}, we received a request to reset your PilotPhD password. Click the button below to choose a new one.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#2563eb;border-radius:8px;">
            <a href="{reset_url}"
               style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Reset password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Or copy this link into your browser:<br/>
        <span style="color:#2563eb;word-break:break-all;">{reset_url}</span>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">This link expires in 1 hour. If you didn't request a password reset, ignore this email — your password won't change.</p>
    """
    await send_email(to, "Reset your PilotPhD password", _email_wrapper("Reset your password", body))
