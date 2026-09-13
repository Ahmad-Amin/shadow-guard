import { resolveAdapter } from "./adapters";
import { attachInterception } from "./interceptor";
import { PlaceholderSession } from "../redaction/placeholders";
import { initSettingsCache } from "../policy/storage";
import { watchForResponseRestoration } from "./responseRestorer";

const adapter = resolveAdapter(location.hostname);

if (adapter) {
  initSettingsCache();
  const session = new PlaceholderSession();
  attachInterception(adapter, session);
  watchForResponseRestoration(adapter, session);
}
