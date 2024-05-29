/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.rs"],
  theme: {
    fontFamily: {
      sans: ["montserrat", ...defaultTheme.fontFamily.sans]
    },
    extend: {
      boxShadow: {
        'inset-amber-400': '0 0 0 2px rgba(251, 191, 36, 1) inset',
      },
      padding: {
        "safe-top": "env(safe-area-inset-top)"
        // "safe-bottom": "env(safe-area-inset-bottom)",
        // "safe-left": "env(safe-area-inset-left)",
        // "safe-right": "env(safe-area-inset-right)",
      },
      future: {
        hoverOnlyWhenSupported: true,
      },
      backgroundImage: {
        hero: "linear-gradient(rgba(255, 252, 250, 0.4), #f9fafb), url('images/background.jpg')",
        herod:
          "linear-gradient(rgba(73, 50, 34, 0.6), #1a1631), url('images/background.jpg')"
      }
    }
  },
  plugins: [
    // require('@tailwindcss/forms'),
  ]
};
