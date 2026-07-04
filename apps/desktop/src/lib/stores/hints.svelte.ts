import { browser } from "$app/environment";

const KEY = "mainspring:hints";

/**
 * Whether the little explanatory blurbs are shown. Off by default to keep the
 * screen uncluttered; the user opts in via the header toggle. Persisted locally.
 */
class Hints {
  show = $state(browser ? localStorage.getItem(KEY) === "1" : false);

  toggle(): void {
    this.show = !this.show;
    if (browser) localStorage.setItem(KEY, this.show ? "1" : "0");
  }
}

export const hints = new Hints();
