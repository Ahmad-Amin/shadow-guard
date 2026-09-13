import { resolveAdapter } from "./adapters";
import { attachInterception } from "./interceptor";
import { PlaceholderSession } from "../redaction/placeholders";
import { initSettingsCache } from "../policy/storage";
import { watchForResponseRestoration } from "./responseRestorer";
import { getCachedEntitlement, initEntitlementCache } from "../license/license";
import { showToast } from "./ui/toast";

const adapter = resolveAdapter(location.hostname);

if (adapter) {
  initSettingsCache();
  const session = new PlaceholderSession();
  attachInterception(adapter, session);
  watchForResponseRestoration(adapter, session);

  void initEntitlementCache().then(() => {
    if (getCachedEntitlement().status === "expired") {
      showToast(
        "Your ShadowGuard trial has ended — open the extension popup to activate your license and resume protection.",
        8000
      );
    }
  });
}
