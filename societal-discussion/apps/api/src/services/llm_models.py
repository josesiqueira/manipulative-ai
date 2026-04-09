"""
Available LLM models configuration.

Defines the models available for each provider with their metadata.
"""

AVAILABLE_MODELS = {
    "openai": {
        "display_name": "OpenAI",
        "models": [
            {"id": "gpt-5.4", "name": "GPT-5.4", "recommended": True},
            {"id": "gpt-4o", "name": "GPT-4o", "recommended": False},
            {"id": "gpt-4.1", "name": "GPT-4.1", "recommended": False},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "recommended": False},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "recommended": False},
        ],
    },
    "anthropic": {
        "display_name": "Anthropic",
        "models": [
            {"id": "claude-sonnet-4-5-20250514", "name": "Claude Sonnet 4.5", "recommended": True},
            {"id": "claude-opus-4-5-20250514", "name": "Claude Opus 4.5", "recommended": False},
            {"id": "claude-haiku-3-5-20241022", "name": "Claude Haiku 3.5", "recommended": False},
        ],
    },
}


def get_providers() -> list[str]:
    """Get list of available provider names."""
    return list(AVAILABLE_MODELS.keys())


def get_models_for_provider(provider: str) -> list[dict]:
    """
    Get available models for a specific provider.

    Args:
        provider: Provider name (e.g., 'openai', 'anthropic')

    Returns:
        List of model dictionaries with id, name, and recommended fields.
        Returns empty list if provider not found.
    """
    provider_data = AVAILABLE_MODELS.get(provider, {})
    return provider_data.get("models", [])


def get_default_model(provider: str) -> str | None:
    """
    Get the recommended (default) model for a provider.

    Args:
        provider: Provider name

    Returns:
        Model ID of the recommended model, or None if provider not found.
    """
    models = get_models_for_provider(provider)
    for model in models:
        if model.get("recommended"):
            return model["id"]
    # Fall back to first model if no recommended
    return models[0]["id"] if models else None


def is_valid_model(provider: str, model_id: str) -> bool:
    """
    Check if a model ID is valid for a given provider.

    Args:
        provider: Provider name
        model_id: Model ID to validate

    Returns:
        True if the model is valid for the provider.
    """
    models = get_models_for_provider(provider)
    return any(m["id"] == model_id for m in models)


def get_provider_display_name(provider: str) -> str:
    """
    Get the display name for a provider.

    Args:
        provider: Provider name

    Returns:
        Display name for the provider, or the provider name if not found.
    """
    provider_data = AVAILABLE_MODELS.get(provider, {})
    return provider_data.get("display_name", provider.title())
