Drop a logo image here (e.g. `logo.png`) and it will be served at `/email/logo.png`
once the app is built/deployed (Vite copies everything in `public/` to the site root).

Then in Settings > Email Outreach 2-way Sync, set "Logo URL (cho email HTML)" to:
`https://<your-deployed-domain>/email/logo.png`

Email clients fetch this image directly from the public internet, not from your
local machine — so the URL only works once the app is actually deployed with the
file present. If you already have the logo hosted elsewhere (CDN, image host), you
can paste that URL directly instead and skip this folder entirely.
