"""
Available LLM models configuration.

Defines the models available for each provider with their metadata.
"""

AVAILABLE_MODELS = {
    "openai": {
        "display_name": "OpenAI",
        "models": [
            {"id": "gpt-6-astra", "name": "GPT-6 Astra (Metso 2026)", "recommended": True},
            {"id": "gpt-5.4", "name": "GPT-5.4 (frontier, 1M context; HEPP 2026)", "recommended": False},
            {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini (cheap, 1M context)", "recommended": False},
            {"id": "gpt-4.1", "name": "GPT-4.1 (1M context, no surcharge)", "recommended": False},
            {"id": "gpt-4o", "name": "GPT-4o (128K — too small for largest party)", "recommended": False},
        ],
    },
    # Prices per million tokens (2026-10-22): Sonnet 5.5 $2 input, $4 one-hour
    # cache write, $0.10 cache read, $10 output; Opus 5.5 $4, $8, $0.20, $20.
    # All three accept 1M input tokens (the largest party prompt counts about
    # 333K tokens with Anthropic's tokenizer).
    "anthropic": {
        "display_name": "Anthropic",
        "models": [
            {"id": "claude-sonnet-5-5", "name": "Claude Sonnet 5.5", "recommended": True},
            {"id": "claude-opus-5-5", "name": "Claude Opus 5.5", "recommended": False},
            {"id": "claude-haiku-5-5", "name": "Claude Haiku 5.5 (higher price over 100K tokens)", "recommended": False},
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
