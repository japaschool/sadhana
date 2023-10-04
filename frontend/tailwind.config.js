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
      padding: {
        "safe-top": "env(safe-area-inset-top)"
        // "safe-bottom": "env(safe-area-inset-bottom)",
        // "safe-left": "env(safe-area-inset-left)",
        // "safe-right": "env(safe-area-inset-right)",
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
