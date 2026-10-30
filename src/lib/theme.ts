export const THEME_KEY = "theme";

/**
 * Runs in <head> before the first paint so the page never flashes the wrong
 * theme. A saved choice wins; otherwise follow the phone/computer setting.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t}catch(e){d.dataset.theme="light"}})()`;
