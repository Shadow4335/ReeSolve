"""Service-layer errors; the API layer maps them to HTTP status codes."""


class ServiceError(Exception):
    """Base class for service errors."""


class NotFound(ServiceError):
    """Unknown id -> 404."""


class InvalidTransition(ServiceError):
    """Illegal state change -> 409."""
