import flowbitePlugin from 'flowbite/plugin'
import { Config } from 'tailwindcss'

export default {
    content: [
        './src/**/*.{html,js,svelte,ts}',
        '../../node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fff8ec',
                    100: '#ffefd0',
                    200: '#ffdc9f',
                    300: '#ffc463',
                    400: '#f5a623',
                    500: '#d98a10',
                    600: '#b8700a',
                    700: '#92560a',
                    800: '#74440e',
                    900: '#5c360f'
                }
            }
        }
    },
    plugins: [flowbitePlugin],
    darkMode: 'class'
} as Config
