import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                "ui-white": "#ffffffff",
                "ui-black": "#000000ff",
                "ui-primary": "#042043ff",
                "ui-secondary": "#0c8ac9ff",
                "ui-accent": "#93bff5ff",
            },
        },
    },
    plugins: [],
};
export default config;