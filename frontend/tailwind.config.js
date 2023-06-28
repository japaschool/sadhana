/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index2.html", "./src/**/*.rs"],
  theme: {
    fontFamily: {
      sans: ["poppins", ...defaultTheme.fontFamily.sans]
    },
    extend: {
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)"
      },
      backgroundImage: {
        hero: "linear-gradient(rgba(255, 252, 250, 0.65), #ffffff), url('images/background.jpg')",
        herod:
          "linear-gradient(rgba(73, 50, 34, 0.7), #1a1631), url('images/background.jpg')"
      }
    }
  },
  plugins: [
    // require('@tailwindcss/forms'),
  ]
};
