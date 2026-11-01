# osher.cc

Public portfolio for Shalev Osher, built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui and Framer Motion.

## Features

- Hebrew and English content with right-to-left support.
- Certifications, experience, CV preview and direct PDF download.
- Public project listings from [shalev-os on GitHub](https://github.com/shalev-os).
- Email and telephone contact links. The contact form prepares a draft in the visitor's email app; the visitor reviews and sends it there.
- Responsive layouts and reduced-motion support.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

The production build is generated in `dist/`. The site is static and requires no application server, database, account system, API credentials or environment variables. Contact messages and CV downloads are not stored or tracked by the application.

The public GitHub projects section requests GitHub's public API directly and hides itself if the API is unavailable. Fonts load from Google Fonts; all certificate and CV files are served from the site's own `public/` directory.

## Deployment

Repository: [shalev-os/oshercc](https://github.com/shalev-os/oshercc).

Serve `dist/` as static files with a history fallback to `index.html`. The checked-in `public/web.config` supplies IIS rewrite rules for standalone hosting. The signed deployment pipeline preserves the production server's existing `web.config` rather than replacing it with build output.

Use the npm lockfile as the sole dependency lockfile. No database migration or service-provider setup is needed.
