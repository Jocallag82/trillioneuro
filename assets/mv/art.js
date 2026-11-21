/* Bespoke SVG illustrations for the priority cards (one per theme). Pure vector, ~1–2 KB each, themed to the site palette.
   Motion is SMIL and is left out entirely when the visitor prefers reduced motion. */
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function A(s) { return reduced ? '' : s; }
  var BG = '<defs><linearGradient id="{k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16306b"/><stop offset="1" stop-color="#050b1d"/></linearGradient>' +
    '<radialGradient id="{k}r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6cc3ff" stop-opacity=".55"/><stop offset="1" stop-color="#6cc3ff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="{k}o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f3d894" stop-opacity=".7"/><stop offset="1" stop-color="#f3d894" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="400" height="230" fill="url(#{k}g)"/>';
  var S = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
  var stars = function () { var o = ''; for (var i = 0; i < 26; i++) { var x = (i * 97 + 31) % 400, y = (i * 53 + 17) % 150; o += '<circle cx="' + x + '" cy="' + y + '" r="' + (0.6 + (i % 3) * 0.4) + '" fill="#cfe2ff" opacity="' + (0.25 + (i % 5) * 0.1) + '"/>'; } return o; };

  var ART = {
    'clean-water': function (k) { return BG +
      '<circle cx="200" cy="120" r="150" fill="url(#' + k + 'r)"/>' + stars() +
      [0, 1, 2, 3].map(function (i) { return '<ellipse cx="200" cy="165" rx="' + (40 + i * 38) + '" ry="' + (9 + i * 8) + '" ' + S + ' stroke="#6cc3ff" stroke-width="1.4" opacity="' + (0.9 - i * 0.2) + '">' + A('<animate attributeName="opacity" values="' + (0.9 - i * .2) + ';.1;' + (0.9 - i * .2) + '" dur="' + (3 + i * .6) + 's" repeatCount="indefinite"/>') + '</ellipse>'; }).join('') +
      '<path d="M200 44c-26 38-44 62-44 88a44 44 0 0 0 88 0c0-26-18-50-44-88Z" fill="#0a1f4a" stroke="#6cc3ff" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M178 126a24 24 0 0 0 20 28" ' + S + ' stroke="#bfe6ff" stroke-width="3" opacity=".8"/>' +
      '<path d="M0 196c40-14 70 14 110 0s70-14 110 0 70 14 110 0 50-8 70-2v36H0Z" fill="#0a1f4a" opacity=".85"/><path d="M0 196c40-14 70 14 110 0s70-14 110 0 70 14 110 0 50-8 70-2" ' + S + ' stroke="#6cc3ff" stroke-width="1.6">' + A('<animateTransform attributeName="transform" type="translate" values="0 0;-22 0;0 0" dur="7s" repeatCount="indefinite"/>') + '</path>'; },

    'poverty-hunger': function (k) { return BG +
      '<circle cx="200" cy="168" r="120" fill="url(#' + k + 'o)"/>' + stars() +
      '<circle cx="200" cy="150" r="34" fill="#f3d894" opacity=".95"/>' +
      [-70, -50, -30, -10, 10, 30, 50, 70].map(function (a) { return '<line x1="200" y1="150" x2="' + (200 + Math.sin(a * Math.PI / 180) * 96) + '" y2="' + (150 - Math.cos(a * Math.PI / 180) * 96) + '" stroke="#f3d894" stroke-width="1.4" opacity=".4"/>'; }).join('') +
      '<path d="M0 190c70-16 130-10 200-2s130 6 200-8v50H0Z" fill="#071533"/>' +
      [60, 100, 140, 260, 300, 340].map(function (x, i) { var h = 46 + (i % 3) * 12; return '<g ' + S + ' stroke="#d8b46a" stroke-width="2"><path d="M' + x + ' 214V' + (214 - h) + '">' + A('<animateTransform attributeName="transform" type="rotate" values="-2 ' + x + ' 214;2.5 ' + x + ' 214;-2 ' + x + ' 214" dur="' + (4 + i * .5) + 's" repeatCount="indefinite"/>') + '</path>' +
        [0, 1, 2, 3, 4].map(function (j) { var y = 214 - h + j * 9; return '<path d="M' + x + ' ' + (y + 6) + 'q-9-1-10-9q8 0 10 6m0 0q9-1 10-9q-8 0-10 6" fill="#d8b46a" stroke="none" opacity=".9"/>'; }).join('') + '</g>'; }).join(''); },

    'healthcare': function (k) { return BG +
      '<circle cx="200" cy="112" r="140" fill="url(#' + k + 'r)"/>' + stars() +
      '<path d="M0 124h92l16-40 22 78 22-96 20 74 14-16h214" ' + S + ' stroke="#6cc3ff" stroke-width="2.6" stroke-dasharray="520" stroke-dashoffset="0">' + A('<animate attributeName="stroke-dashoffset" values="520;0;0;-520" keyTimes="0;.5;.7;1" dur="5s" repeatCount="indefinite"/>') + '</path>' +
      '<g transform="translate(200 54)"><rect x="-17" y="-5" width="34" height="10" rx="3" fill="#f3d894"/><rect x="-5" y="-17" width="10" height="34" rx="3" fill="#f3d894"/></g>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { var x = 60 + i * 28, y = 190 + Math.sin(i * .7) * 14, y2 = 190 - Math.sin(i * .7) * 14; return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + y2 + '" stroke="#3b8cff" stroke-width="1" opacity=".5"/><circle cx="' + x + '" cy="' + y + '" r="4" fill="#6cc3ff"/><circle cx="' + x + '" cy="' + y2 + '" r="4" fill="#f3d894"/>'; }).join(''); },

    'education': function (k) { return BG +
      '<circle cx="200" cy="100" r="150" fill="url(#' + k + 'o)" opacity=".7"/>' + stars() +
      [-60, -40, -20, 0, 20, 40, 60].map(function (a) { return '<line x1="200" y1="150" x2="' + (200 + Math.sin(a * Math.PI / 180) * 130) + '" y2="' + (150 - Math.cos(a * Math.PI / 180) * 130) + '" stroke="#f3d894" stroke-width="1.2" opacity=".35">' + A('<animate attributeName="opacity" values=".12;.5;.12" dur="' + (3 + Math.abs(a) / 30) + 's" repeatCount="indefinite"/>') + '</line>'; }).join('') +
      '<path d="M200 156c-34-16-84-16-122-4v56c38-12 88-12 122 4Z" fill="#0a1f4a" stroke="#6cc3ff" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M200 156c34-16 84-16 122-4v56c-38-12-88-12-122 4Z" fill="#0d2a63" stroke="#6cc3ff" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M200 156v56" ' + S + ' stroke="#f3d894" stroke-width="2"/>' +
      [[96, 172], [96, 184], [96, 196]].map(function (p) { return '<path d="M' + p[0] + ' ' + p[1] + 'h72" ' + S + ' stroke="#6cc3ff" opacity=".4" stroke-width="1.4"/>'; }).join('') +
      '<path d="M170 62l8 18 18 8-18 8-8 18-8-18-18-8 18-8Z" fill="#f3d894">' + A('<animateTransform attributeName="transform" type="rotate" values="0 170 88;360 170 88" dur="14s" repeatCount="indefinite"/>') + '</path>' +
      '<path d="M254 80l5 11 11 5-11 5-5 11-5-11-11-5 11-5Z" fill="#6cc3ff" opacity=".9"/>'; },

    'climate': function (k) { return BG +
      '<circle cx="200" cy="118" r="140" fill="url(#' + k + 'r)"/>' + stars() +
      '<circle cx="200" cy="122" r="74" fill="#0a1f4a" stroke="#6cc3ff" stroke-width="2"/>' +
      '<path d="M158 108c14-18 34-10 40-24 8 10 26 6 34 20-10 6-6 22-22 24-10-14-30-4-52-20Z M176 150c10-6 18 6 30 0 8 12 24 14 30 4-2 14-14 24-30 22-12-2-22-10-30-26Z" fill="#2f8f6a" opacity=".85"/>' +
      '<ellipse cx="200" cy="122" rx="108" ry="26" ' + S + ' stroke="#f3d894" stroke-width="1.6" transform="rotate(-18 200 122)" opacity=".8">' + A('<animate attributeName="stroke-dasharray" values="0 700;700 0" dur="6s" repeatCount="indefinite"/>') + '</ellipse>' +
      '<path d="M200 214V170" ' + S + ' stroke="#7fe0b0" stroke-width="3"/><path d="M200 190c-16 0-26-8-28-22 16 0 26 8 28 22Zm0-8c14 0 24-8 26-22-14 0-24 8-26 22Z" fill="#7fe0b0">' + A('<animateTransform attributeName="transform" type="scale" values="1;1.08;1" additive="sum" dur="4s" repeatCount="indefinite"/>') + '</path>'; },

    'science-tech': function (k) { return BG +
      '<circle cx="200" cy="112" r="140" fill="url(#' + k + 'r)"/>' + stars() +
      [0, 60, 120].map(function (a, i) { return '<ellipse cx="200" cy="112" rx="104" ry="38" ' + S + ' stroke="#6cc3ff" stroke-width="1.6" transform="rotate(' + a + ' 200 112)" opacity=".85"/>' +
        '<circle r="5" fill="#f3d894"><animateMotion dur="' + (5 + i * 1.3) + 's" repeatCount="indefinite" path="M-104 0a104 38 0 1 0 208 0a104 38 0 1 0 -208 0" rotate="auto"/></circle>'.replace('<circle r="5" fill="#f3d894">', '<g transform="translate(200 112) rotate(' + a + ')"><circle r="5" fill="#f3d894">').replace('</circle>', '</circle></g>'); }).join('') +
      '<circle cx="200" cy="112" r="14" fill="#f3d894"/><circle cx="200" cy="112" r="26" fill="url(#' + k + 'o)"/>' +
      '<path d="M20 206h70l12-16h40M380 206h-70l-12-16h-40M150 214h100" ' + S + ' stroke="#3b8cff" stroke-width="1.6"/>' +
      '<circle cx="142" cy="190" r="3.5" fill="#6cc3ff"/><circle cx="258" cy="190" r="3.5" fill="#6cc3ff"/>'; },

    'housing': function (k) { return BG +
      '<circle cx="200" cy="140" r="150" fill="url(#' + k + 'o)" opacity=".55"/>' + stars() +
      '<path d="M0 214V170h34v-30h40v40h30v-56h46v56h30v-24h40v24h26v-44h50v44h34v-24h30v68Z" fill="#0a1634" opacity=".95"/>' +
      '<path d="M148 214v-62l52-44 52 44v62Z" fill="#0d2a63" stroke="#f3d894" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<rect x="184" y="170" width="32" height="44" rx="2" fill="#f3d894">' + A('<animate attributeName="opacity" values="1;.75;1" dur="3.4s" repeatCount="indefinite"/>') + '</rect>' +
      '<rect x="160" y="158" width="18" height="18" fill="#6cc3ff" opacity=".8"/><rect x="222" y="158" width="18" height="18" fill="#6cc3ff" opacity=".8"/>' +
      [[40, 188], [60, 196], [118, 184], [300, 192], [330, 186], [356, 196]].map(function (p, i) { return '<rect x="' + p[0] + '" y="' + p[1] + '" width="7" height="9" fill="#f3d894" opacity="' + (i % 2 ? .9 : .55) + '"/>'; }).join('') +
      '<path d="M0 60l400 0" stroke="none"/><path d="M20 40l60 22 60-22 60 22 60-22 60 22 60-22" ' + S + ' stroke="#6cc3ff" stroke-width="1.3" opacity=".7"/>'; },

    'community': function (k) { return BG +
      '<circle cx="200" cy="115" r="140" fill="url(#' + k + 'o)" opacity=".8"/>' + stars() +
      '<path d="M200 56a42 42 0 0 0-22 78c4 3 6 8 6 13v9h32v-9c0-5 2-10 6-13a42 42 0 0 0-22-78Z" fill="#0a1f4a" stroke="#f3d894" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M186 166h28M188 176h24" ' + S + ' stroke="#6cc3ff" stroke-width="2.4"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { var a = i * Math.PI / 6, r = 98 + (i % 3) * 10; return '<circle cx="' + (200 + Math.cos(a) * r * 1.3).toFixed(1) + '" cy="' + (112 + Math.sin(a) * r * .62).toFixed(1) + '" r="' + (3 + (i % 3)) + '" fill="' + (i % 2 ? '#6cc3ff' : '#f3d894') + '">' + A('<animate attributeName="opacity" values="1;.25;1" dur="' + (2.2 + i * .25) + 's" repeatCount="indefinite"/>') + '</circle>'; }).join(''); }
  };

  window.MVArt = function (key, uid) {
    var f = ART[key] || ART.community, k = 'a' + (uid || key).replace(/[^a-z0-9]/gi, '').slice(0, 10);
    return '<svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" focusable="false">' + f(k) + '</svg>';
  };
})();
