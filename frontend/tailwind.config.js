/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ["./index2.html", "./src/**/*.rs"],
  theme: {
    fontFamily: {
      'sans': ['poppins', ...defaultTheme.fontFamily.sans],
    },
    extend: {
      backgroundImage: {
        'hero': "linear-gradient(rgba(73, 50, 34, 0.7), #1a1631), url('background.jpg')",
      }
    }
    // colors: {
    //   'button-red': '#ff0000',
    // }
  },
  plugins: [
    // require('@tailwindcss/forms'),
  ],

}
