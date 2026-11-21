# Zebra's Shop — GitHub raw loaders with private licenses

## Architecture

Six full Lua products have locally generated, **reversibly obfuscated/encoded** builds. Their paid payloads are stored as AES-256-GCM sealed files in `sealed-payloads/`. The private decryption key is held in Render environment settings; it must **never** be committed.

This public repository contains six **thin, encoded loader stubs**, not the real paid scripts:

| SKU | Public raw URL |
|---|---|
| Control Center | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/control-center.lua |
| STR Grinder | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/str-grinder.lua |
| END Grinder | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/end-grinder.lua |
| DEX Desktop | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/dex-desktop.lua |
| DEX Mobile | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/dex-mobile.lua |
| FPS Optimizer | https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/fps-optimizer.lua |

After server-verified ownership, **My Account → Generate loader** returns a personal, single-paste Luau command that assigns their private `ZBL_` license to the executor environment, then calls `loadstring(game:HttpGet("https://raw.githubusercontent.com/.../loaders/<sku>.lua"))()`. The public loader clears the temporary environment variable and calls the protected Render API `/api/loader/<sku>?key=...`. Render checks the license and Stripe-verified or Stripe-confirmed free-promo entitlement **every time** before decrypting and serving the protected script.

The former direct Render loader URLs remain compatible for buyers who already generated them.

## Existing historical GitHub repos

The default branches of `MadeByZebra/script`, `script2`, `script3`, `script4` and `Script5` have been replaced with the **Control Center licensed public bootstrap**, not the former freely accessible code. They are legacy URLs, **not** six separate product endpoints.

**Crucial:** Previous commits, clones, forks, cached raw links and the GitHub commit diff may still contain the original script bytes. Updating a current branch **does not erase** Git history. For meaningful concealment of old versions, change these five legacy repositories to private, or remove/replace them through a reviewed history-removal procedure. The new loader URLs above belong to the marketplace repo and can remain public even if legacy repos become private. Assume anything previously posted publicly has already been copied.

## What 'obfuscated' means

The locally available `*_OBFUSCATED.lua` builds use reversible Lua encoding, not MoonSec/MoonVeil. No proprietary MoonSec/MoonVeil transformation was performed in this update. The *public bootstrap* also uses reversible string encoding and contains no full product code. Actual protection comes from backend license enforcement + private sealed payloads, not from hiding GitHub content.

A buyer with an active license can still save or reverse-engineer code delivered to their game client. No obfuscator can guarantee anti-extraction.

## Launch and security checks

- Do not put original or complete obfuscated product source in `loaders/`, `public/` or an open GitHub repository.
- Keep `ZEBRA_PAYLOAD_KEY` only in Render's private environment. Do not embed buyer-specific licenses in public files.
- Stripe payment and webhook verification must be tested before accepting real money. The current Render `DISABLE_CHECKOUT=1` setting must remain until this passes.
- Test each loader in its target Luau runtime. Files and static checks alone do **not** establish game execution compatibility.
- If replacing stored encoded payloads with commercially obfuscated MoonVeil outputs, run target-game acceptance tests, reseal with the private key, and deploy only new `.sealed` ciphertext files. Do not upload new obfuscated payloads directly to GitHub raw.
