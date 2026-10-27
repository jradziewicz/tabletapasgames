import tailwindcss from '@tailwindcss/postcss'

// Must match the data-game-ui attribute GameUI.svelte puts on the game's root, derived from the
// typeId ('locust'); otherwise none of this bundle's Tailwind CSS applies on the live site.
const scopePrefix = '[data-game-ui="locust"]'

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
    plugins: [tailwindcss(), scopeGameCssPlugin]
}
