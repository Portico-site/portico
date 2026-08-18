# Signing the Windows installer

Right now the installer is unsigned. Every person who downloads it meets this:

> **Windows protected your PC** — Microsoft Defender SmartScreen prevented an
> unrecognised app from starting. Publisher: Unknown publisher.

They then have to find **More info → Run anyway**, which is a button most people
never look for. For an application whose entire argument is that you can trust it
with what you type, that first screen works against everything the rest of it says.

Nothing in the code needs to change. electron-builder already signs when it finds a
certificate; `npm run dist` currently calls `signtool.exe`, finds nothing to sign
with, and produces an unsigned file. Verify at any time with:

```powershell
Get-AuthenticodeSignature ".\dist\Portico Setup 0.23.0.exe" | Format-List Status, SignerCertificate
```

`Status: NotSigned` means unsigned. `Status: Valid` means done.

## The options, cheapest first

| | Cost | Reputation | Notes |
|---|---|---|---|
| **SignPath Foundation** | free | inherits theirs | For OSS projects. You apply and they review the project. Slowest to start, nothing to pay, and the certificate is theirs rather than yours. |
| **Azure Trusted Signing** | ~$10/month | builds over time | Microsoft's own service. Cheapest paid route by a wide margin. Requires an Azure account and, for an individual, a verified identity. |
| **OV certificate** | ~$200–400/year | builds over time | From a reseller. You hold the certificate. Reputation still has to accumulate before SmartScreen stops warning. |
| **EV certificate** | ~$400–600/year | **immediate** | The only option with no SmartScreen warning from the first download. Requires a hardware token or cloud HSM, and usually a registered company. |

The honest summary: OV and Trusted Signing remove *Unknown publisher* and put your
name on the dialog, but SmartScreen can still warn until enough people have installed
it. EV is the only one that is clean on day one, and it is the one that expects a
company behind it.

## Once you have one

**A certificate file (OV/EV in .pfx form)** — electron-builder reads two environment
variables and needs no config change:

```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "the password"
npm run release
```

Never commit the .pfx or the password. In GitHub Actions, put them in repository
secrets and pass them the same way — the workflow already builds on tags.

**Azure Trusted Signing** — add this to the `build.win` block of `package.json` and
set the three environment variables it names:

```json
"azureSignOptions": {
  "publisherName": "Your Name",
  "endpoint": "https://eus.codesigning.azure.net",
  "certificateProfileName": "your-profile",
  "codeSigningAccountName": "your-account"
}
```

```powershell
$env:AZURE_TENANT_ID = "…"
$env:AZURE_CLIENT_ID = "…"
$env:AZURE_CLIENT_SECRET = "…"
```

## Until then

The download page publishes the SHA-256 of the exact file it serves, recomputed from
the bytes on every release by `scripts/stage-release.js`, with the command to check
it. That lets a careful person verify they got what was published. It does not help
the person who just clicks Download, which is most people — hence this page.

## macOS, when it comes

Same problem, stricter: unsigned and un-notarised apps are refused outright rather
than warned about, and Gatekeeper cannot be talked past as easily. That needs an
Apple Developer account at $99/year, `mac.notarize` in the build config, and an
app-specific password in `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.
Worth knowing before promising a `.dmg`.
