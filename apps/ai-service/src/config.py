"""Environment configuration with Pydantic. Fails fast on missing vars."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    port: int = 4002
    log_level: str = "info"

    database_url: str = "postgresql://supportpilot:supportpilot@localhost:5432/supportpilot"
    redis_url: str = "redis://localhost:6379"

    llm_provider: str = "mock"  # mock | gemini | openai
    gemini_api_key: str = ""
    openai_api_key: str = ""

    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "supportpilot-files"
    aws_region: str = "ap-south-1"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    ai_confidence_threshold: float = 0.55

    daily_call_quota: int = 1000
    daily_token_quota: int = 1_000_000

    model_config = {
        "env_prefix": "",
        "case_sensitive": False,
        "env_file": (".env", "../../.env"),
        "extra": "ignore",
    }


settings = Settings()
