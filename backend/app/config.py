from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str
    jwt_secret: str = Field(min_length=32)
    hotel_timezone: str = 'Asia/Riyadh'
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    access_token_minutes: int = Field(default=120, ge=5, le=1440)


settings = Settings()
