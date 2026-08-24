# anti-slop (vendored)

Oxlint rules vendored from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (MIT license).

The upstream project is not published to npm, so the plugin files are vendored here under
`rules/` and `shared/`, wired together in `index.ts`. To update, re-download the assets from
`skills/install-anti-slop/assets/anti-slop/` in the upstream repo and re-apply any local
changes (this repo excludes the `require-safety-comment-for-type-assertion` rule from the
default set at first vendoring; it was later re-enabled — see `.oxlintrc.json` for the
authoritative rule list).
