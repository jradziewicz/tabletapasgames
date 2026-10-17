import { redirect } from '@sveltejs/kit'

// The About page lives on the studio's own site; old links to /about land there.
export function load() {
    redirect(308, 'https://www.tabletapasgames.com/about')
}
