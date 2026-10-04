FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv==0.9.21
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY apps/api/app ./app
COPY apps/api/migrations ./migrations
COPY apps/api/alembic.ini ./
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/waypoint-entrypoint
# Demo mode keeps its generated signing key here (a named volume in docker-compose.yml).
RUN mkdir -p /var/lib/waypoint
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
ENTRYPOINT ["waypoint-entrypoint"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
