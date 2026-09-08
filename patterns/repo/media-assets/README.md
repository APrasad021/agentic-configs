# media-assets

> Status: **draft** · stacks: sh · requires: `repo/scaffold`

## What this ships

- `docs/media-assets.md` — the decision table for where a binary belongs
- `scripts/check-media.sh` — a pre-commit guard with a 1 MB default

## The problem it solves

Git stores every version of a binary forever and binaries do not delta. A 4 MB
PNG replaced monthly for two years is ~100 MB in every clone, permanently —
CI, teammates, every fresh agent sandbox. Deleting the file does not reclaim
it; the objects stay in history.

So the guard is at commit time, because that is the only cheap moment. After
the push, the options are "live with it" or "rewrite history and break every
clone."

## Why the LFS rules are not applied automatically

LFS is a one-way door: every clone needs the client, CI needs `lfs: true`,
some hosts bill for bandwidth, and un-adopting it means rewriting history.
This pattern gives you the block to paste and makes you paste it.

## Why "draft"

The decision table and the guard are solid. What is unsettled is the deploy
half of the story — CDN wiring, content-hash naming, and image transformation
are all platform-specific (Cloudflare Images, Vercel, imgix, self-hosted), and
picking one here would be guessing. That belongs with `ci/release-deploy` once
your platform is decided.
