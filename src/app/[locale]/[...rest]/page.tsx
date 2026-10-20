import { notFound } from "next/navigation";

// This page only exists to throw, so there is no UI for instant-navigation
// validation to check. Browsers also hit it in the background (e.g. Chrome
// DevTools requests /.well-known/appspecific/com.chrome.devtools.json).
export const instant = false;

// Unknown paths under a locale render the localized not-found page.
export default function CatchAllPage() {
  notFound();
}
