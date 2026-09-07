# Banana shoulder and taper checkpoint

The existing radius profile now transitions gradually into the body, and the stalk lifts smoothly by 4 mm while staying inside the existing height envelope. Gross dimensions change by less than 0.11 micrometres, without scaling. Material, lighting, camera and continuous closed skin remain unchanged. Existing topology validation and contact baking pass: 4,762 vertices, 9,520 triangles, no manifold/winding/area/overlap failures. No runtime adoption.

An independent reviewer with no banana history first inspected all three fulls and three crops here, then the corresponding baseline in `../banana-prepared` and rejected intermediate in `../banana-end-rejected`. Candidate is preferred for the bounded pass (medium-high confidence): gentler left shoulder and more continuous right taper, no grounding regression. The intermediate lost recognizable terminal shape and is rejected.

Remaining high-confidence realism issues: smooth sealed nubs do not distinguish a cut stalk/collar from a blossom scar; near/right end still looks fin-like/pinched; the body remains uniformly inflated. These require the immediately following terminal-anatomy pass, not a claim of shape acceptance. All eighteen inspected images remain available across these three directories.

Shared exporter/staging and the existing validator remain the only owners; syntax/diff checks pass. Codex CLI review was attempted but cannot use configured gpt-6-astra with the installed CLI version. Fresh image critique ran successfully through an available peer after initial spawn hit the thread limit. The author also inspected all candidate fulls/crops; this self-review is primed. Browser/contact integration and materials remain unadopted.
