import { resolveAdapter } from "./adapters";
import { attachInterception } from "./interceptor";
import { PlaceholderSession } from "../redaction/placeholders";
import { watchForResponseRestoration } from "./responseRestorer";

const adapter = resolveAdapter(location.hostname);

if (adapter) {
  const session = new PlaceholderSession();
  attachInterception(adapter, session);
  watchForResponseRestoration(adapter, session);
}
