# TFI · Lector de máquinas · v0.1.2

Standalone Spanish live barcode/QR scanner for the maintenance TEST app. The scanner decodes on the phone and sends only the decoded identifier to the opening app. No Google account, ChatGPT account or app credentials are embedded here.

## Publish on GitHub Pages (about 5 minutes)

1. Create a new public repository named `tfi-scanner`. This repository contains only this generic scanner; keep Apps Script code, spreadsheet exports, personal links and meter photos out of it.
2. Upload this folder's contents, preserving the `vendor` folder. `index.html` must be at the repository root.
3. Open **Settings > Pages**. Select **Deploy from a branch**, **main**, **/(root)**, then **Save**. Retain the actual HTTPS site URL GitHub returns.
4. Open that published URL on the phone without VPN, allow the camera and scan a product barcode. The code should appear with the camera switched off. This standalone test does not save a TFI record.
5. Install the separate PRIVATE Apps Script v0.1.2 package in TEST only. Reload the TEST workbook and choose **PRUEBAS TFI > 3. Configurar lector GitHub**. Paste the published scanner URL. Update the existing TEST deployment to **New version** and open David's personal TEST link. No setup reset or token rotation is needed.

GitHub Free Pages uses a public repository. This site has no access to inventory records, permissions, meter photos or personal app links. The maintainer controls future code changes; protect the GitHub account and review updates.

## Runtime behavior

- Live rear-camera preference, barcode and QR support; no file picker.
- ZXing `@zxing/library` version **0.23.0** is vendored in this repository. No runtime JavaScript CDN dependency or `latest` URL.
- No analytics, image uploads, persistent scan history or scan-result console logs in the scanner wrapper.
- A restrictive page Content Security Policy blocks fetch/WebSocket connections, frames, forms and external scripts. Browser/hosting traffic still exists for loading the page and its local assets. This does not promise zero host/browser logging.
- Camera stops after a successful decode, stop button, navigation, backgrounding, or 60-second timeout.
- Decode results are text, never executable HTML or automatically opened QR URLs.
- The public scanner receives no TFI user bearer token and no machine roster. The parent app matches the identifier against its own authorized data and requires explicit confirmation.
- The bridge uses a five-minute random correlation nonce in the URL fragment. Exact origin, source-window, nonce, expiry and payload checks apply in the parent. Successful matching consumes the session; an unknown code can be rescanned until the same session expires.
- **Volver a mantenimiento** appears after acknowledgment. If browser isolation loses the opener or closes/reloads the original app, copy the code and paste into the app's manual search. Automatic focus/close behavior still needs a field round-trip test on iPhone/Android.
- A QR label can contain a serial/PIN/Holt code, or `TFI-MACHINE:<stable machine UUID>`. Never print someone's personal access link on a label.

## Verification

Run `node scanner-tests.cjs` with Node 18 or later; no npm install is required. It verifies live-camera constraints with a mock camera, bridge origin checks, track shutdown, CSP restrictions and the vendor SRI checksum. An independently generated ReportLab EAN-13 fixture is decoded with the real vendored SDK and must return `7595461000032`. The fixture is a product barcode, not a TFI machine identifier.

The old upstream camera demo was successfully used on David's iPhone. This package's own live hosting and Apps Script round trip are not yet verified; they must be checked after publication. A successful product scan does not prove that the machine plaque's black barcode is readable or that its contents match a printed serial.

## License and provenance

The vendored ZXing library is distributed under **Apache-2.0**, with the upstream license retained in `vendor/ZXING-LICENSE.txt`. Keep that notice when redistributing. The package version, file hash and browser integrity value are recorded in `vendor/VENDOR.json`.

## Versioning

Use GitHub commits to review and revert scanner changes. Tag the first reviewed deployment `v0.1.2`. Keep scanner hosting separate from the Google Apps Script TEST deployment and the production inventory project. This version has no service worker/offline installation; those can be evaluated separately after the online round trip works.
