// Which model provider answers, asked when a page loads. A page that shows
// provider text renders every variant hidden ([data-provider-variant]), a
// loading line ([data-provider-loading]) and an error line
// ([data-provider-error], hidden). showProvider() shows the variant of the
// provider GET /api/provider names, fills the model name spans, and puts the
// provider id on <html data-provider>. Runs in client scripts.
import { getProvider, type ProviderInfo } from './participantApi';

// The spans withModelSlot() rendered; an empty name leaves nothing behind.
export function fillModelName(root: ParentNode, name: string): void {
  root.querySelectorAll<HTMLElement>('[data-model-name]').forEach((span) => {
    span.textContent = name ? `${span.dataset.lead ?? ''}${name}` : '';
  });
}

const all = (selector: string) => document.querySelectorAll<HTMLElement>(selector);

// null when the provider is unknown (request failed, 503, unknown id): the
// error line is shown and no variant.
export async function showProvider(): Promise<ProviderInfo | null> {
  const html = document.documentElement;
  html.dataset.providerState = 'loading';
  delete html.dataset.provider;
  all('[data-provider-variant]').forEach((el) => (el.hidden = true));
  all('[data-provider-error]').forEach((el) => (el.hidden = true));
  all('[data-provider-loading]').forEach((el) => (el.hidden = false));
  let info: ProviderInfo | null = null;
  try {
    info = await getProvider();
  } catch {
    info = null;
  }
  all('[data-provider-loading]').forEach((el) => (el.hidden = true));
  if (!info) {
    all('[data-provider-error]').forEach((el) => (el.hidden = false));
    html.dataset.providerState = 'error';
    return null;
  }
  const { provider, model_name } = info;
  all('[data-provider-variant]').forEach((el) => (el.hidden = el.dataset.providerVariant !== provider));
  fillModelName(document, model_name);
  html.dataset.provider = provider;
  html.dataset.providerState = 'ready';
  return info;
}
