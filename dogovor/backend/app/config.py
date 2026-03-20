from pydantic_settings import BaseSettings


def _parse_cors_origins(value: str) -> list[str]:
    """CORS_ORIGINS: через запятую, например http://localhost:3001,https://dogovor.example.com"""
    if not value or not value.strip():
        return []
    return [x.strip() for x in value.split(",") if x.strip()]


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    # Источник данных для БД и Storage:
    # - "supabase" (по умолчанию, текущий режим)
    # - "postgres" (вариант б): Postgres + MinIO на российском сервере
    data_backend: str = "supabase"
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

    # Postgres (data_backend=postgres)
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_db: str = "dogovor"
    postgres_user: str = ""
    postgres_password: str = ""

    # MinIO (data_backend=postgres): S3-совместимое хранилище для PDF и подписей
    minio_endpoint: str = ""
    minio_port: int = 9000
    minio_secure: bool = False
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_presign_seconds: int = 3600
    # Предобработка фото перед Биорг (ресайз, контраст, резкость). true = включено (по умолчанию для теста).
    preprocess_passport_image: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_cors_origins(self.cors_origins)


settings = Settings()
