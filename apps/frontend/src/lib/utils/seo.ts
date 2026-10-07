// Search engines see one page (the SPA's index.html) at every URL, so each path, with or without
// a trailing slash, /index.html, or any query string, read as a separate copy of the same page
// ("Duplicate without user-selected canonical" in Search Console). Signed-in pages also bounce
// crawlers to /login ("Page with redirect"). The root layout uses these to point every public page
// at one canonical URL and keep everything else out of the index. static/sitemap.xml lists the
// same public pages.

export const SITE_ORIGIN = 'https://play.tabletapasgames.com'

// Pages anyone can read without signing in. Everything else needs an account (or is a one-off
// link like a password reset) and is not worth indexing.
export const INDEXABLE_PATHS = ['/', '/about', '/privacy', '/terms'] as const

export function normalizePath(pathname: string): string {
    let path = pathname.replace(/\/index\.html$/, '/')
    if (path.length > 1) path = path.replace(/\/+$/, '')
    return path || '/'
}

export function isIndexablePath(pathname: string): boolean {
    return (INDEXABLE_PATHS as readonly string[]).includes(normalizePath(pathname))
}

export function canonicalUrl(pathname: string): string {
    const path = normalizePath(pathname)
    return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}
