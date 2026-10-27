# TFI · Lector de máquinas · v0.1.5

Standalone Spanish live barcode/QR scanner for the maintenance TEST app. The scanner decodes on the phone and sends only the decoded identifier to the opening app. No Google account, ChatGPT account or app credentials are embedded here.

Published TEST scanner: https://driedi-ops.github.io/CamScanner/

## v0.1.5 update

Return labels now refer to the opening form, so the same generic scanner can serve maintenance and inventory machine selection. The bridge payload, origin checks, local decoder, camera startup and return behavior are unchanged. Compatible with private TEST Apps Script v0.2.0 (maintenance, consumption/issue machine assignment and equipment transfer) and the previous v0.1.2 maintenance bridge. No roster, inventory data or user token is added to this public repository.

## v0.1.4 update

Opening the scanner from the maintenance app now makes one automatic camera-start attempt once the tab is visible. The app's existing **Escanear** tap supplies the user's intent; no additional scanner-button tap is normally needed. Ordinary visits to the bare public URL keep the manual **Abrir cámara** button. If automatic access is blocked, that button reappears with a retry/settings explanation. There are no automatic denial retries, background camera starts, or automatic restarts after stopping/backgrounding. Camera permission belongs to the browser: this code reuses any permission it retains, but cannot grant itself access, make a temporary grant permanent, or suppress a required prompt. No persistent permission flag or camera stream is stored. This scanner-only update remains compatible with private Apps Script v0.1.2.

## v0.1.3 update

Scanner-only update, compatible with the private Apps Script v0.1.2 bridge. No Apps Script reinstall, configuration reset or redeployment is required for these updates. After Apps Script acknowledges that one machine was selected, the scanner immediately requests focus for the app and closes its own tab. It does not close merely because a barcode was decoded. Unknown codes remain open with an explanation and rescan controls. If the browser keeps the tab open, a prominent **✓ Máquina recibida** confirmation and **Volver a mantenimiento** button remain. A blocked focus request no longer prevents the close request.

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
- Accepted acknowledgments trigger immediate automatic return. Focus/close remain subject to browser restrictions; the success confirmation and return button are the fallback. A three-second acknowledgment timeout explicitly says delivery is unconfirmed, while still allowing a late valid reply. If browser isolation loses the opener or closes/reloads the original app, copy the code and paste into the app's manual search.
- A QR label can contain a serial/PIN/Holt code, or `TFI-MACHINE:<stable machine UUID>`. Never print someone's personal access link on a label.

## Verification

Run `node scanner-tests.cjs` with Node 18 or later; no npm install is required. It verifies automatic camera startup for visible app launches, manual fallback after denial without permission loops, no background start or restart after stopping, automatic return only after an accepted acknowledgment, source/origin/nonce validation, unknown-code and missing-reply behavior, denied focus/close fallbacks, live-camera constraints with a mock camera, track shutdown, CSP restrictions and the vendor SRI checksum. An independently generated ReportLab EAN-13 fixture is decoded with the real vendored SDK and must return `7595461000032`. The fixture is a product barcode, not a TFI machine identifier.

The user's iPhone recording confirms that scanner v0.1.3 reads a plaque and returns to Apps Script with the machine selected. The complete hours/photo/save workflow has not yet been field-tested. Version v0.1.4 automatic camera startup still needs a field test on the user's browser. A successful scan does not prove that every machine plaque's black barcode is readable or that its contents match a printed serial.

## License and provenance

The vendored ZXing library is distributed under **Apache-2.0**, with the upstream license retained in `vendor/ZXING-LICENSE.txt`. Keep that notice when redistributing. The package version, file hash and browser integrity value are recorded in `vendor/VENDOR.json`.

## Versioning

Use GitHub commits to review and revert scanner changes. Keep scanner hosting separate from the Google Apps Script TEST deployment and the production inventory project. Scanner v0.1.4 is compatible with Apps Script TEST v0.1.2. This version has no service worker/offline installation; those can be evaluated separately after the online round trip works.
