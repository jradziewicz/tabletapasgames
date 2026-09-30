import tailwindcss from '@tailwindcss/postcss'

// Must match the data-game-ui attribute GameUI.svelte (libs/frontend-components) puts on the
// game's root element, which is derived from the game's typeId ('stellarventures'), not the
// package name. With the package name here, none of this bundle's own Tailwind CSS applied on
// the live site - only classes the site frontend happened to generate itself did.
const scopePrefix = '[data-game-ui="stellarventures"]'

const scopeGameCssPlugin = {
    postcssPlugin: 'scope-game-css-plugin',
    Rule(rule) {
        const sourceFile = (rule.source?.input?.file ?? '').replace(/\\/g, '/')
        if (!sourceFile.endsWith('/src/app.css')) {
            return
        }

        if (
            rule.parent?.type === 'atrule' &&
            ['keyframes', '-webkit-keyframes', '-moz-keyframes'].includes(rule.parent.name)
        ) {
            return
        }

        if (!rule.selectors) {
            return
        }

        rule.selectors = rule.selectors.map((selector) => {
            if (!selector) {
                return selector
            }

            const trimmed = selector.trim()
            if (!trimmed) {
                return trimmed
            }

            if (trimmed.startsWith(scopePrefix)) {
                return trimmed
            }

            if (trimmed === ':root' || trimmed.startsWith('html') || trimmed.startsWith('body')) {
                return scopePrefix
            }

            return `${scopePrefix} ${trimmed}`
        })
    }
}

export default {
    plugins: [
        tailwindcss(),
        scopeGameCssPlugin
    ]
}
