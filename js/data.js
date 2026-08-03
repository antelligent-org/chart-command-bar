/**
 * The dashboard's source data: twelve months of revenue across three product
 * lines. Never mutated. Every tool changes `state` instead, and the renderer
 * derives what it draws from these two together.
 *
 * The spread is deliberate. Self-serve is two orders of magnitude larger than
 * Enterprise, so on a linear axis Enterprise is a flat line along the bottom and
 * you genuinely cannot see that it has grown 7x over the year. That is what
 * makes "the small numbers are invisible" a real complaint rather than a staged
 * one, and it is the moment the log scale earns its place in the demo.
 */
window.CCB = window.CCB || {};

CCB.data = {
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  series: [
    {
      label: 'Self-serve',
      colour: 'gold',
      values: [41200, 43800, 44100, 47600, 49900, 52300, 51800, 55400, 58900, 61200, 64800, 68300],
    },
    {
      label: 'Teams',
      colour: 'violet',
      values: [8400, 9100, 10300, 11800, 12600, 14900, 16200, 18700, 21400, 24100, 27300, 30800],
    },
    {
      label: 'Enterprise',
      colour: 'emerald',
      values: [210, 240, 310, 380, 420, 560, 690, 780, 910, 1080, 1240, 1470],
    },
  ],
};
