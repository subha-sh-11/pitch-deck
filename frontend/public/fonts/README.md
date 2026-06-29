# Fonts

## Canela (Commercial Type — licensed)

The auth headings ("Welcome Back" / "Create your free account") use **Canela**.
It is a commercial font and is **not** bundled in this repo for licensing reasons.

To enable it, drop your licensed `.woff2` files here with these exact names:

- `Canela-Regular.woff2`
- `Canela-Medium.woff2`
- `Canela-Bold.woff2`

The `@font-face` declarations live in `src/app/globals.css` (`.font-canela`).
Until the files are present, the headings fall back to the existing Cormorant serif.
