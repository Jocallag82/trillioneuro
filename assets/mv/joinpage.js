/* /join — mounts the registration / sign-in component and shows the live founding-places counter. */
(function () {
  'use strict';
  var MV = window.MV;
  if (MV.$('#joinbox')) window.MVJoin.mount(MV.$('#joinbox'));
})();
