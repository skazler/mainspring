import { localToday } from "$lib/date";

/**
 * The calendar date, as reactive state.
 *
 * A desktop app sits open for days. Anything that reads the clock inside a
 * getter is only recomputed when some *other* reactive input changes, so
 * "this month" would keep meaning last month until the user happened to edit
 * something — the spending budget would not reset on the 1st for anyone who
 * never quits the app. Reading `clock.today` / `clock.month` instead of calling
 * the date helpers directly makes the rollover itself an input.
 *
 * Ticks once a minute: far cheaper than it needs to be, and fine enough that
 * midnight looks instant.
 */
class Clock {
  today = $state(localToday());
  readonly month: string = $derived(this.today.slice(0, 7));

  constructor() {
    setInterval(() => {
      const now = localToday();
      if (now !== this.today) this.today = now;
    }, 60_000);
  }
}

export const clock = new Clock();
