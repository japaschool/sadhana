pub const INPUT_CSS: &'static str = "rounded-md bg-transparent peer placeholder-transparent px-2 h-10 w-full border dark:border-white dark:text-white border-zinc-300 text-zinc-300 focus:border-2 focus:border-zinc-100 focus:outline-none focus:ring-0";
pub const TEXTAREA_CSS: &'static str = "rounded-md bg-transparent peer placeholder-transparent px-2 w-full border dark:border-white dark:text-white border-zinc-300 text-zinc-300 focus:border-2 focus:border-zinc-100 focus:outline-none focus:ring-0";
pub const INPUT_LABEL_CSS: &'static str = "absolute left-2 -top-7 dark:text-white text-zinc-300 text-base peer-placeholder-shown:text-base dark:peer-placeholder-shown:text-white peer-placeholder-shown:text-zinc-300 peer-placeholder-shown:top-2 transition-all peer-focus:-left-0 peer-focus:-top-7 dark:peer-focus:text-white peer-focus:text-zinc-300 peer-focus:text-base";
pub const LINKS_CSS: &'static str ="relative flex justify-between sm:text-base links";
pub const LINK_CSS: &'static str = "no-underline hover:underline text-base dark:text-white text-zinc-300";
pub const LINK_CSS_NEW_ACC: &'static str = "no-underline hover:underline text-base text-orange-400 dark:orange-200";
pub const SUBMIT_BTN_CSS: &'static str =
    "rounded-md text-white w-full cursor-pointer text-base font-semibold mb-8 border border--orange-600 p-2 outline-none
    bg-gradient-to-r from-orange-200 via-orange-300 to-orange-400 
hover:bg-orange-500 hover:bg-opacity-10
active:bg-orange-500 active:bg-opacity-25
dark:-bg-opacity-10 dark:from-orange-900/50 dark:to-dark-orange-900/100
dark:-hover:bg-orange-900 dark:hover:bg-opacity-30
dark:-active:bg-orange-900 
active:translate-y-1";

// <button type="button" class="text-white bg-[#FF9119] hover:bg-[#FF9119]/80 focus:ring-4 focus:outline-none focus:ring-[#FF9119]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:hover:bg-[#FF9119]/80 dark:focus:ring-[#FF9119]/40 mr-2 mb-2">
//   <svg class="w-4 h-4 mr-2 -ml-1" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="bitcoin" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M504 256c0 136.1-111 248-248 248S8 392.1 8 256 119 8 256 8s248 111 248 248zm-141.7-35.33c4.937-32.1-20.19-50.74-54.55-62.57l11.15-44.7-27.21-6.781-10.85 43.52c-7.154-1.783-14.5-3.464-21.8-5.13l10.93-43.81-27.2-6.781-11.15 44.69c-5.922-1.349-11.73-2.682-17.38-4.084l.031-.14-37.53-9.37-7.239 29.06s20.19 4.627 19.76 4.913c11.02 2.751 13.01 10.04 12.68 15.82l-12.7 50.92c.76 .194 1.744 .473 2.829 .907-.907-.225-1.876-.473-2.876-.713l-17.8 71.34c-1.349 3.348-4.767 8.37-12.47 6.464 .271 .395-19.78-4.937-19.78-4.937l-13.51 31.15 35.41 8.827c6.588 1.651 13.05 3.379 19.4 5.006l-11.26 45.21 27.18 6.781 11.15-44.73a1038 1038 0 0 0 21.69 5.627l-11.11 44.52 27.21 6.781 11.26-45.13c46.4 8.781 81.3 5.239 95.99-36.73 11.84-33.79-.589-53.28-25-65.99 17.78-4.098 31.17-15.79 34.75-39.95zm-62.18 87.18c-8.41 33.79-65.31 15.52-83.75 10.94l14.94-59.9c18.45 4.603 77.6 13.72 68.81 48.96zm8.417-87.67c-7.673 30.74-55.03 15.12-70.39 11.29l13.55-54.33c15.36 3.828 64.84 10.97 56.85 43.03z"></path></svg>
//   Pay with Bitcoin
// </button>

pub const BODY_DIV_CSS: &'static str ="pt-12 text-base leading-6 space-y-10 dark:text-white text-zinc-300 sm:leading-7";
pub const MENU_CSS: &'static str ="text-zinc-300  dark:text-white text-2xl flex justify-between whitespace-nowrap items-center";