from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import URL, Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    url = settings.database_url or URL.create(
        "postgresql+psycopg",
        username=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    )
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 3})


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
