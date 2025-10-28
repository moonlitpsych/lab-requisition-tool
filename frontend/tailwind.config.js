// frontend/tailwind.config.js
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                // Moonlit Brand Colors
                primary: {
                    // Terracotta/Salmon - Primary accent
                    50: '#fef5f3',
                    100: '#fce8e4',
                    200: '#f8d4cc',
                    300: '#f3baa9',
                    400: '#E89C8A', // Main terracotta
                    500: '#e08771',
                    600: '#d56f56',
                    700: '#b55944',
                    800: '#91493a',
                    900: '#753d32',
                },
                navy: {
                    // Deep Navy - Headlines and primary text
                    50: '#e6e9ed',
                    100: '#c1c8d3',
                    200: '#98a3b5',
                    300: '#6f7e97',
                    400: '#4e5f7e',
                    500: '#2d4165',
                    600: '#1a2f50',
                    700: '#0A1F3D', // Main navy
                    800: '#081a32',
                    900: '#051127',
                },
                cream: {
                    // Cream/Off-White - Backgrounds
                    50: '#ffffff',
                    100: '#fdfbf9',
                    200: '#F5F1ED', // Main cream background
                    300: '#ede7e1',
                    400: '#e0d7ce',
                    500: '#d3c7ba',
                    600: '#bfb09e',
                    700: '#a89785',
                    800: '#8e7d6b',
                    900: '#746455',
                },
                taupe: {
                    // Tan/Taupe - Buttons and interactive elements
                    50: '#f7f4ef',
                    100: '#ede6dc',
                    200: '#ddd0bc',
                    300: '#C5A882', // Main tan/taupe
                    400: '#b59768',
                    500: '#a38654',
                    600: '#8b7147',
                    700: '#705b3a',
                    800: '#5a4930',
                    900: '#473a27',
                },
                accent: {
                    // Supporting colors
                    mint: '#D4F1E8',       // Success states
                    coral: '#F5D6C8',      // Warning states
                    peach: '#F5C8B3',      // Highlights
                    lightMint: '#e5f7f1',  // Light success
                    lightCoral: '#fae8e0', // Light warning
                }
            },
            fontFamily: {
                serif: ['Baskerville', 'Georgia', 'Caslon', 'Times New Roman', 'serif'], // For headings
                sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'], // For body
                mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace']
            },
            borderRadius: {
                DEFAULT: '8px',
                'sm': '6px',
                'md': '8px',
                'lg': '12px',
                'xl': '16px',
                'pill': '9999px', // For badges
            },
            boxShadow: {
                'soft': '0 2px 8px rgba(10, 31, 61, 0.05)', // Subtle navy shadow
                'medium': '0 4px 16px rgba(10, 31, 61, 0.08)', // Medium depth
                'large': '0 8px 24px rgba(10, 31, 61, 0.1)', // For modals
                'warm': '0 4px 12px rgba(197, 168, 130, 0.15)', // Warm taupe shadow
                'card': '0 1px 3px rgba(10, 31, 61, 0.05), 0 1px 2px rgba(10, 31, 61, 0.08)', // Card shadow
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'bounce-gentle': 'bounceGentle 1s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                bounceGentle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                }
            }
        },
    },
    plugins: [],
}