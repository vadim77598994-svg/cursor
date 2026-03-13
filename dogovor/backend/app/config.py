from pydantic_settings import BaseSettings


def _parse_cors_origins(value: str) -> list[str]:
    """CORS_ORIGINS: через запятую, например http://localhost:3001,https://dogovor.example.com"""
    if not value or not value.strip():
        return []
    return [x.strip() for x in value.split(",") if x.strip()]


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    storage_bucket: str = "contracts"
    # CORS: через запятую. Пусто = только localhost:3000,3001 для разработки
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    # Отправка писем: "smtp" (Яндекс на Timeweb) или "resend" (API на Railway, где SMTP заблокирован)
    email_provider: str = "smtp"
    # SMTP (Яндекс: smtp.yandex.ru:465 SSL) — используется при email_provider=smtp
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Пай Оптикс"
    # Resend (api.resend.com) — используется при email_provider=resend
    resend_api_key: str = ""
    resend_from_email: str = ""
    resend_from_name: str = "Пай Оптикс"
    # Beorg API (распознавание паспорта РФ: разворот + прописка). Пустые = эндпоинт /passport/recognize недоступен.
    beorg_project_id: str = ""
    beorg_token: str = ""
    beorg_machine_uid: str = ""
    # Предобработка фото перед Биорг (ресайз, контраст, резкость). true = включено (по умолчанию для теста).
    preprocess_passport_image: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_cors_origins(self.cors_origins)


settings = Settings()
