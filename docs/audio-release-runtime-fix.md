# Audio release verification correction

The production upload verification workflow rejected the audio release because the inherited Next.js 16.3.2 runtime and transitive dependencies failed `npm audit --omit=dev --audit-level=high` (one critical, two high, one moderate). The audio conversion/regression suite and build had passed; this was a dependency audit failure rather than an audio code failure.

Update Next.js and its matching ESLint configuration to 16.4.3, the stable release including the vendor's October security fixes. Refresh compatible vulnerable transitive packages in the lockfile. Keep the audio implementation unchanged. Add the production audit to the central release CI so every release is checked, even when path-limited legacy workflows do not run.

Vendor references: https://nextjs.org/blog/nextjs-security-update-october-14-2026 and https://github.com/vercel/next.js/releases/tag/v16.4.3. The lockfile now resolves source-map-js 1.2.2 and baseline-browser-mapping 2.11.33. The existing upload-proxy verification workflow also watches package and lockfile changes so dependency-only corrections exercise that audit.

Verification requires a clean production audit, the complete existing test suite, the production build, successful central CI for the exact release commit, and target-specific release proofs for both web applications. The audio worker is verified separately through its `/health` identity and the web upload-proxy/CORS health check.

The first main CI attempt was cancelled after 15 minutes while downloading FFmpeg dependencies from `azure.archive.ubuntu.com` (99 packages, 94.1 MB). Setup now uses Ubuntu's official HTTPS archive in the disposable runner mirror list, excludes recommended packages, and has separate bounded FFmpeg installation, Python installation and audio-test steps. Package signature checks remain enabled and all six real audio tests remain mandatory.
