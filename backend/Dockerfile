# ANUMATI API. Build from backend/:  docker build -t anumati-api .
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /srv
COPY requirements.txt requirements-postgres.txt ./
RUN pip install -r requirements-postgres.txt
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/anumati-entrypoint
RUN useradd --system --uid 10001 --home-dir /srv anumati && mkdir -p /srv/storage && chown anumati /srv/storage
USER anumati
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"
ENTRYPOINT ["anumati-entrypoint"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
