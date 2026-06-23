# Releasing the Tauri build (auto-update)

The app self-updates via **tauri-plugin-updater**, pulling a manifest from GitHub
Releases. Update flow is already wired in the app (the titlebar shows an update
banner → Download → Install/relaunch). What's left is operational: a signing key,
a signed build, and publishing the manifest.

## 1. One-time: generate the signing key

The updater verifies downloads with a minisign keypair. Generate it once and keep
the **private** key + password secret (a password manager / CI secret — never
commit it):

```sh
pnpm dlx @tauri-apps/cli@latest signer generate -w "$HOME/.refract/updater.key"
```

This prints a **public key**. Paste it into
`apps/tauri/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, replacing
`REPLACE_WITH_TAURI_SIGNER_PUBLIC_KEY`. Commit that (the public key is not secret).

> Until a real public key is in place, `check()` will fail signature verification
> at runtime (no update shown) — the rest of the app is unaffected.

Operational rules for the private key:

- Store the private key only in a password manager and in GitHub Actions secrets.
- Do not put the private key in the repo, release artifacts, logs, issue comments,
  screenshots, or local scripts.
- Use `TAURI_SIGNING_PRIVATE_KEY` for the full private key contents, not a path.
- Use `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only for the key password.
- Limit repository admin and secret access to release maintainers.
- Rotate immediately if the private key or password may have been exposed:
  generate a new keypair, replace `plugins.updater.pubkey`, commit it, and ship
  one manual installer so future updates trust the new public key.

## 2. Build signed installers

Bump the version in `apps/tauri/src-tauri/tauri.conf.json` and the package
versions, then push a `v*.*.*` tag or run the `Release (Tauri)` workflow
manually. The workflow builds release artifacts for:

- Windows x64
- macOS Apple Silicon
- macOS Intel
- Linux x64

For local testing, build on the target OS with the signing secrets in the
environment:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$HOME/.refract/updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<your password>"
pnpm build:signed   # run from apps/tauri
```

For GitHub Actions, define repository secrets with the same names. The release
workflow reads only those secrets and creates a draft release for review.

Output (under `src-tauri/target/release/bundle/`, depending on OS):

- Windows: `nsis/*.exe`, `msi/*.msi`, plus `.sig` files
- macOS: `dmg/*.dmg`, `macos/*.app.tar.gz`, plus `.sig` files
- Linux: `appimage/*.AppImage`, `deb/*.deb`, `rpm/*.rpm`, plus `.sig` files

## 3. Publish to GitHub Releases

The `Release (Tauri)` workflow uploads platform installers and the generated
`latest.json` updater manifest to the draft release. Review the assets, then
publish the draft and mark it as the latest release.

The generated manifest should contain every supported updater platform:

```json
{
  "version": "1.2.0",
  "notes": "What changed…",
  "pub_date": "2026-06-23T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<paste the FULL contents of the .sig file>",
      "url": "https://github.com/RefractMC/Refract_MC/releases/download/v1.2.0/Refract_1.2.0_windows_x64-setup.exe"
    },
    "darwin-aarch64": {
      "signature": "<paste the FULL contents of the .sig file>",
      "url": "https://github.com/RefractMC/Refract_MC/releases/download/v1.2.0/Refract_1.2.0_macos_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<paste the FULL contents of the .sig file>",
      "url": "https://github.com/RefractMC/Refract_MC/releases/download/v1.2.0/Refract_1.2.0_macos_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "<paste the FULL contents of the .sig file>",
      "url": "https://github.com/RefractMC/Refract_MC/releases/download/v1.2.0/Refract_1.2.0_linux_x64.AppImage"
    }
  }
}
```

The app's endpoint is `…/releases/latest/download/latest.json`, so the release
with the manifest must be the **latest** release. On next launch the app compares
its version to `latest.json`, shows the banner, and updates on click.

## #26 - upgrading existing installs to the Tauri build

- **App id is the same** (`com.refract`) and the Tauri backend reads/writes the
  **same** `%APPDATA%/Refract` data dir, so **instances, config, Java, themes
  carry over automatically** with no migration step.
- **Accounts need a one-time re-login**: tokens live in the keyring-backed
  Stronghold vault, so old encrypted tokens aren't readable. Offline accounts
  still work; Microsoft accounts must sign in again once.
- Preferred automatic path: publish the signed Tauri release first, then run the
  `Release (Electron bridge)` workflow with the same tag. It uploads
  `latest.yml`, the bridge installer, and its blockmap to the release for old
  Electron clients. The bridge downloads the Tauri `latest.json` installer,
  starts it, quits, and future updates are handled by Tauri.
- Manual fallback: ship the Tauri NSIS installer as the next version. Users run
  it once over the existing install at the same install path/app id, then
  auto-update takes over.
