"""One error format for every response: RFC 9457 Problem Details (application/problem+json).

`detail` is always one readable sentence, so any screen can show it as it is; field problems are also listed in
`errors`, and `requestId` matches the X-Request-ID header and the server log line.
"""
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_MEDIA_TYPE = "application/problem+json"

PROBLEM_SCHEMA = {
    "title": "Problem",
    "type": "object",
    "description": "RFC 9457 Problem Details. `detail` is a sentence that can be shown to the user as it is.",
    "required": ["type", "title", "status", "detail"],
    "properties": {
        "type": {"type": "string", "example": "about:blank"},
        "title": {"type": "string", "example": "Unprocessable Content"},
        "status": {"type": "integer", "example": 422},
        "detail": {"type": "string", "example": "Please check signer: String should have at least 3 characters."},
        "instance": {"type": "string", "example": "/api/applications"},
        "requestId": {"type": "string", "example": "1d58b0d51a56"},
        "errors": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["field", "message"],
                "properties": {"field": {"type": "string"}, "in": {"type": "string"}, "message": {"type": "string"}},
            },
        },
    },
}


def problem(request: Request, status: int, detail: str, *, errors: list[dict] | None = None, headers: dict | None = None) -> JSONResponse:
    body = {"type": "about:blank", "title": HTTPStatus(status).phrase, "status": status, "detail": detail, "instance": request.url.path}
    rid = getattr(request.state, "request_id", None)
    if rid:
        body["requestId"] = rid
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type=PROBLEM_MEDIA_TYPE, headers=headers)


def _field(loc: tuple) -> str:
    return ".".join(str(p) for p in loc[1:]) or str(loc[0])


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else HTTPStatus(exc.status_code).description
    return problem(request, exc.status_code, detail, headers=getattr(exc, "headers", None))


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"field": _field(tuple(e["loc"])), "in": str(e["loc"][0]), "message": e["msg"]} for e in exc.errors()]
    first = errors[0] if errors else {"field": "request", "message": "Invalid request"}
    more = f" (and {len(errors) - 1} more)" if len(errors) > 1 else ""
    return problem(request, 422, f"Please check {first['field']}: {first['message']}.{more}", errors=errors)


def install(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)

    def openapi() -> dict:
        """Documents the Problem format for every error the API can return."""
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes, tags=app.openapi_tags)
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        components.pop("HTTPValidationError", None)
        components.pop("ValidationError", None)
        components["Problem"] = PROBLEM_SCHEMA
        def content() -> dict:  # a fresh object each time, so exported YAML has no anchors or aliases
            return {PROBLEM_MEDIA_TYPE: {"schema": {"$ref": "#/components/schemas/Problem"}}}

        for path in schema.get("paths", {}).values():
            for op in path.values():
                responses = op.setdefault("responses", {})
                if "422" in responses:
                    responses["422"] = {"description": "The request could not be accepted; `detail` says why", "content": content()}
                responses.setdefault("4XX", {"description": "Problem Details (not signed in, not allowed, not found, too many requests…)", "content": content()})
        app.openapi_schema = schema
        return schema

    app.openapi = openapi
