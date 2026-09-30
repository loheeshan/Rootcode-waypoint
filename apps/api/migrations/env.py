from alembic import context

from app.db.base import Base
from app.db.session import get_engine

# Import domain models here as they are added so metadata is complete.
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(
        url=get_engine().url, target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
