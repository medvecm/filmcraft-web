# FilmCraft on the web

A browser build of [FilmCraft](https://github.com/storytold/filmcraft), the open-source video
editor, published with GitHub Pages:

**https://medvecm.github.io/filmcraft-web/**

Open it in Chrome on a Chromebook (or Chrome/Edge anywhere). To install it as an app, use the
install icon at the right of the address bar, or ⋮ ▸ Cast, save, and share ▸ Install FilmCraft.
The installed app has a launcher icon and its own window, and it starts without a network
connection. Media and projects stay on your device; nothing is uploaded.

This repository holds only the built site. The source is
[storytold/filmcraft](https://github.com/storytold/filmcraft) (`apps/filmcraft-web`, documented
in `docs/web.md`). FilmCraft is MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`),
and the fonts built into it are OFL-1.1 (`OFL-*.txt`).

## Updating

```sh
./deploy.sh [path/to/filmcraft]   # default: ../storytold/filmcraft
```

This builds the web app from that checkout (`cargo xtask web`), replaces the site with one fresh
commit, and force-pushes it. The installed app picks up the new build the next time it starts
online.
