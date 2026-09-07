# Browser engine smoke coverage

Firefox 155.0 and Playwright WebKit 26.6 pass the bounded production smoke:
setup assets ready, twenty flies released, native fly model loaded, pause,
reverse/forward seek, cancellation back to setup, and another release. Both use
WebGL2 on the installed Apple GPU and report no page errors. This checks those
flows, not full-attempt performance or every graphics configuration.

The reports retain the exact served simulation build identity
`c8874644fcfa93fb312e8d3dff9c531dcd2b19882178644445ca9fac5ed61b5c`,
asset response status, attempt metadata, console messages and screenshots. The
static build was served at port 5322; the harness checkout does not imply that it
built the served bundle. Firefox's headless WebGPU adapter is unavailable, but
that is irrelevant to this WebGL2 production renderer.

Actual Safari 26.4 is installed, but SafariDriver rejects sessions because remote
automation is disabled. No preference was changed and no browser was installed.
Safari therefore remains untested. Playwright WebKit is a separate runtime and
its passing result is not Safari acceptance.

The first Firefox request inherited a lab path from an older harness. The static
server correctly returned 404 at `/lab/setup`; that failed screenshot/report is
retained under `rejected-route`. The corrected smoke uses production `/`.

`tests/browser/engine-smoke.mjs` runs one installed engine at a time using
`SMOKE_ENGINE=firefox` or `webkit`, with `BRAIN_URL` and `SMOKE_OUTPUT` selecting the
server and evidence destination. Browser launch and each UI wait are bounded;
cleanup runs after both success and failure. Run engines sequentially when they
share a GPU. Safari's rejected session is retained separately.
