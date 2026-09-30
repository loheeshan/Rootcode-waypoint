from alembic import context
from sqlalchemy import Connection

from app.db.models import Base
from app.db.session import get_engine

target_metadata = Base.metadata


def run_online(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(
        url=get_engine().url, target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    supplied_connection = context.config.attributes.get("connection")
    if supplied_connection is not None:
        if not isinstance(supplied_connection, Connection):
            raise TypeError("Alembic connection must be a SQLAlchemy Connection")
        run_online(supplied_connection)
    else:
        with get_engine().connect() as connection:
            run_online(connection)
