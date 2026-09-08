# Images, video and other binaries

## The decision, first

| Asset | Where it goes |
|---|---|
| Icons, logos, small UI images (< 100 KB) | Straight into git |
| Screenshots for docs | Into git, but compress first |
| Design source files (`.fig`, `.psd`) | Not in git — link to the tool |
| Video, audio, anything > 5 MB | Object storage (S3/R2/CDN); commit a URL |
| Large binaries you truly must version | Git LFS |
| Model weights, datasets | Never git. Object storage, versioned by name |

## Why the threshold is so low

Git stores every version of a binary forever, and binaries do not delta well.
A 4 MB PNG replaced monthly for two years is ~100 MB in every clone, forever —
including CI, including every fresh agent sandbox. Deleting the file later does
not shrink the repo; the objects stay in history.

The cost is paid by everyone who clones, every time, on a repo that grows
monotonically. That is why it is worth being strict early rather than
rewriting history later.

## Git LFS block

Append to `.gitattributes` **only if you actually adopt LFS**:

```gitattributes
*.psd  filter=lfs diff=lfs merge=lfs -text
*.mp4  filter=lfs diff=lfs merge=lfs -text
*.mov  filter=lfs diff=lfs merge=lfs -text
*.zip  filter=lfs diff=lfs merge=lfs -text
```

This pattern does **not** write it for you. LFS is a one-way door: every
clone needs the client installed, CI needs `lfs: true` on checkout, some hosts
bill for LFS bandwidth, and un-adopting it means rewriting history. Decide
deliberately.

`repo/scaffold`'s `.gitattributes` already marks these types `binary`, which
is the part that helps regardless of whether you use LFS.

## Before committing an image

```bash
# lossless, typically 20-50% smaller
oxipng -o 4 --strip safe image.png
# or
pngquant --quality=65-85 image.png
```

For screenshots in docs, WebP at quality 80 is usually a quarter the size of
the PNG and indistinguishable.

## Deploys and media

Serve media from a CDN, not from your app. Reference it by content hash so
cache invalidation is free and a stale asset is impossible.
