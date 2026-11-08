'use strict';

/* One reversible scroll timeline owns camera, lighting and the bridge copy. */
(function (root) {
  const clamp = n => !Number.isFinite(n) || n <= 1e-12 ? 0 : n >= 1-1e-12 ? 1 : n;
  const montage = n => { const t = clamp(n); return t*t*t*(t*(t*6-15)+10); };

  function sample(progress) {
    const p = clamp(progress);
    // Stages do not overlap: intro -> rigid camera/light -> depth/text -> library.
    const intro = montage(p / .14);
    const sweep = montage((p - .14) / .19);
    const entry = montage((p - .33) / .2);
    const exit = montage((p - .75) / .2);
    const sceneOpacity = p >= .53 ? 0 : 1-entry;
    const hyperbola = (Math.sqrt(1 + 5 * (2*sweep-1)**2)-1) / (Math.sqrt(6)-1);
    return {
      progress: p,
      cameraTurn: sweep,
      parallax: entry,
      sunX: .09 + .82 * sweep,
      sunY: .15 + .39 * hyperbola,
      darkness: 0,
      saturation: 1.4 * (1-sweep),
      snowShadow: .22 - .15 * sweep,
      snowFill: .35 + .45 * sweep,
      snowHighlight: .2 + .55 * sweep,
      sceneOpacity,
      lightOpacity: (.42 + .2*Math.sin(Math.PI*sweep)**2) * sceneOpacity,
      textOpacity: p >= .95 ? 0 : entry * (1-exit),
      textY: .75 - .25 * entry - .25 * exit,
      copyOpacity: 1-intro,
      copyY: -.8*intro,
      loadAlbums: p >= .95,
      albumReveal: montage((p - .95) / .05)
    };
  }

  const api = Object.freeze({ sample, travelVh:520 });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DialSceneMotion = api;
})(globalThis);
