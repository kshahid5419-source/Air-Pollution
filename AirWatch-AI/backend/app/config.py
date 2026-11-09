from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./airwatch.db"
    frontend_origin: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def cors_origins(self) -> list[str]:
        """Parse comma-separated origins and always include safe local defaults."""
        origins = [o.strip() for o in self.frontend_origin.split(",") if o.strip()]
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
        if "*" in origins:
            return ["*"]
        return list(dict.fromkeys(origins + defaults))


settings = Settings()
