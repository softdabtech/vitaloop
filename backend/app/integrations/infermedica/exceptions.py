class InfermedicaError(RuntimeError):
    """Base error safe to handle at the VITALOOP service boundary."""


class InfermedicaDisabledError(InfermedicaError):
    pass


class InfermedicaConfigurationError(InfermedicaError):
    pass


class InfermedicaAuthenticationError(InfermedicaError):
    pass


class InfermedicaRequestError(InfermedicaError):
    def __init__(self, status_code: int):
        super().__init__(f"Infermedica rejected the request with status {status_code}")
        self.status_code = status_code


class InfermedicaRateLimitError(InfermedicaError):
    pass


class InfermedicaUnavailableError(InfermedicaError):
    pass


class InfermedicaResponseError(InfermedicaError):
    pass
