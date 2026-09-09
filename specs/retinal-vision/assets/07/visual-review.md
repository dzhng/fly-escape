# Recoverable recording errors

**Superseded:** the integrating review rejected the icon-only recovery affordance. The current candidate and checks are in [recovery](recovery/README.md). This file preserves the earlier assessment as review provenance.

Target: the message must say what failed and give a practical next step without clipping; the existing recovery control must remain visible and usable. Compare only the message/action region. The world render is context and is outside this change.

All seven captured states, their enlarged message/control crops, and the standard-versus-unsupported comparison were inspected. A fresh screenshot reviewer could not be started: the collaboration tool returned `agent thread limit reached`. This assessment uses the screenshot-critique skill's explicit no-agent fallback. It is an adversarial self-review, not an independent review.

## Strongest visible case against acceptance

- Standard interruption: the peach message box could blend into the cream panel, making the error easy to overlook.
- Old format: the longer instruction could crowd the same small message box and lose its last phrase.
- Future format: the three-line message leaves “eyes” on a short last line, weakening scanning.
- Truncated metadata: the short damage message could be too generic to explain the failure.
- Corrupt metadata: the same generic message could leave a reader searching for a technical detail that is not shown.
- Old format after accepted chunks: sixteen fly cards compete with the error message for attention.
- Invalid payload after accepted chunks: a still-populated scene could suggest that playback remains usable after the failure.
- Recovery control in every state: the icon-only X is not self-describing at a glance, and it is far from the message.

## Assessment

The messages remain fully within their boxes, with visible padding and readable dark text. The future-format box expands rather than clipping its third line. The error stays at the top of the panel when fly cards are present; the lower-left playback panel independently says “Flight interrupted.” The controlled browser assertions confirm that playback stops, the recovery button is enabled, its confirmation returns to setup, and seeded persistence remains unchanged.

The X-only recovery affordance has a discoverability limitation visible in both the existing reference and the candidate. This change preserves the existing control and its accessible label. It is a follow-up usability concern, not evidence of a broken recovery path; the browser test exercises the actual control in every state.

The candidate unsupported-record message is less wrong than the standard interruption for an old recording because it explains the incompatibility and supplies the relevant next step. The [crop metrics](browser/visual-metrics.json) confirm a real content change at the same crop dimensions; they do not substitute for the visual judgment. No clipped or obscured message was found. Error-message presentation is accepted within this preparatory scope, with the icon discoverability limitation recorded above. Physical scene brightness is not assessed here.
