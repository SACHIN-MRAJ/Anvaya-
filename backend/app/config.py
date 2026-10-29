"""Settings, read from environment variables prefixed ANUMATI_ (or a .env file)."""
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ANUMATI_", env_file=".env", extra="ignore")

    # staging behaves like production (single sign-on, PostgreSQL, strong secret) but may load the sample cycle.
    env: Literal["development", "test", "staging", "production"] = "development"
    # SQLite needs no installation; production uses postgresql+asyncpg://user:pass@host/anumati
    database_url: str = "sqlite+aiosqlite:///./anumati.db"
    # PostgreSQL: migrations run as the owner role; the API runs as anumati_app (see migrations/).
    database_admin_url: str = ""
    db_pool: Literal["queue", "null"] = "queue"  # "null" opens a connection per use (tests, or behind PgBouncer)
    # Per API process. Keep workers x (size + overflow) below PostgreSQL's max_connections (default 100);
    # when every connection is busy a request waits up to db_pool_timeout seconds instead of failing.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 30
    # PostgreSQL only: enforce row-level security per request (the app connects as a role that RLS applies to).
    db_row_security: bool = True

    # Sign-in. "dev" issues a session cookie for sample users from /api/auth/dev-login.
    # "oidc" signs people in through Keycloak (authorization code + PKCE) and then issues the same session cookie;
    # browser JavaScript never sees a Keycloak token.
    auth_mode: Literal["dev", "oidc"] = "dev"
    secret_key: str = "dev-only-secret-change-me-0123456789abcdef"  # noqa: S105  (refused in staging and production)
    session_minutes: int = 15
    web_url: str = "http://localhost:5180"  # where people open the website; sign-in returns here
    oidc_issuer: str = ""  # as the browser sees it, e.g. http://localhost:8081/realms/anumati
    oidc_internal_issuer: str = ""  # as the API reaches it, e.g. http://keycloak:8080/realms/anumati (default: oidc_issuer)
    oidc_client_id: str = "anumati-web"
    oidc_client_secret: str = ""
    oidc_audience: str = "anumati-web"  # audience accepted on Bearer tokens from other systems

    cors_origins: list[str] = ["http://localhost:5180", "http://127.0.0.1:5180"]
    rate_limit_per_minute: int = 240
    redis_url: str = ""  # e.g. redis://valkey:6379/0: the rate limit is then shared by every API process and server
    max_json_kb: int = 1024

    storage_backend: Literal["local", "s3"] = "local"
    storage_dir: Path = Path("./storage")
    s3_endpoint: str = ""  # host:port, e.g. minio:9000
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "anumati-files"
    s3_secure: bool = True
    s3_region: str = "ap-south-1"
    max_upload_mb: int = 10
    clamd_host: str = ""  # e.g. "127.0.0.1:3310"; empty skips the virus scan

    drand_url: str = "https://api.drand.sh/public"
    drand_timeout_seconds: float = 2.5

    # Alerts. "log" writes to the server log and the notifications table; real channels need credentials.
    email_mode: Literal["log", "smtp"] = "log"
    smtp_url: str = ""
    sms_mode: Literal["log", "http"] = "log"
    sms_api_url: str = ""
    whatsapp_mode: Literal["log", "http"] = "log"
    whatsapp_api_url: str = ""
    webhook_secret: str = ""  # when set, WhatsApp/SMS webhooks must carry X-Hub-Signature-256 = HMAC-SHA256 of the body
    bhashini_api_key: str = ""

    # Ask ANUMATI. Without a key it answers from the handbook, the published rules and the person's own records.
    # With an AI API key, the LLM engine synthesizes each reply from the verified handbook sources and cites them;
    # questions and matching handbook passages (plus, for a signed-in person, their own files) are sent to the model.
    anthropic_api_key: str = ""
    ai_api_key: str = ""
    assistant_model: str = "neural-assistant-v1"
    assistant_timeout_seconds: float = 25.0

    # Background clock: checks deadlines, reminders and escalations.
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60

    # Operations
    log_format: Literal["text", "json"] = "text"
    metrics_token: str = ""  # when set, /metrics needs "Authorization: Bearer <token>"

    # The sample data is dated around 22 Oct 2026. Leave empty in production to use the real date.
    fixed_today: str = "2026-10-22"

    seed_on_start: bool = True

    @property
    def secure(self) -> bool:
        return self.env in ("staging", "production")

    @model_validator(mode="after")
    def _safe_for_production(self) -> "Settings":
        """Refuses to start a staging or production server with development shortcuts left on."""
        if not self.secure:
            return self
        checks = [
            (self.secret_key.startswith("dev-only") or len(self.secret_key) < 32, "set ANUMATI_SECRET_KEY to a random value of 32+ characters"),
            (self.auth_mode != "oidc", "set ANUMATI_AUTH_MODE=oidc (development sign-in checks no password)"),
            (self.auth_mode == "oidc" and not (self.oidc_issuer and self.oidc_client_secret), "set ANUMATI_OIDC_ISSUER and ANUMATI_OIDC_CLIENT_SECRET"),
            (self.database_url.startswith("sqlite"), "use PostgreSQL: ANUMATI_DATABASE_URL=postgresql+asyncpg://..."),
        ]
        if self.env == "production":
            checks += [
                (bool(self.fixed_today), "leave ANUMATI_FIXED_TODAY empty so the real date is used"),
                (self.seed_on_start, "set ANUMATI_SEED_ON_START=false"),
                (not self.webhook_secret, "set ANUMATI_WEBHOOK_SECRET so only your WhatsApp and SMS providers can call the webhooks"),
            ]
        problems = [msg for bad, msg in checks if bad]
        if problems:
            raise ValueError(f"Unsafe {self.env} settings: " + "; ".join(problems))
        return self


settings = Settings()


def today() -> date:
    return date.fromisoformat(settings.fixed_today) if settings.fixed_today else date.today()
