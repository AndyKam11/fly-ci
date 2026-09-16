/* A local image export: capture the actual renderer, then add the result UI. */
(() => {
  function capture(viewer) {
    const display = viewer?.display;
    if (!display?.canvas || typeof display.draw !== 'function') throw new Error('The brain viewer is not ready.');
    // Neuroglancer uses this same draw-then-read sequence for its own screenshots.
    display.draw();
    if (!display.canvas.width || !display.canvas.height) throw new Error('The brain is not visible yet.');
    return display.canvas.toDataURL('image/png');
  }
  function lines(ctx, text, width) {
    const out = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { out.push(line); line = word; }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  async function render(result) {
    if (!result?.brain) throw new Error('The brain image is not ready.');
    const brain = new Image();
    brain.src = result.brain;
    await brain.decode();
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export is unavailable in this browser.');
    const color = result.score < 30 ? '#ff5a5a' : '#b6ff3b';
    ctx.fillStyle = '#08080d'; ctx.fillRect(0, 0, 1200, 1200);
    ctx.textBaseline = 'top';
    ctx.font = '64px Bungee, Impact, sans-serif';
    ctx.fillStyle = '#f4f1e8'; ctx.fillText('BRAIN', 54, 38);
    const brandWidth = ctx.measureText('BRAIN ').width;
    ctx.fillStyle = '#b6ff3b'; ctx.fillText('ROT', 54 + brandWidth, 38);
    ctx.font = '27px system-ui, sans-serif'; ctx.fillStyle = '#9d9db3';
    ctx.fillText('A fruit fly brain rated my LinkedIn post.', 54, 128);

    // Fit the real frame without cropping away neurons on narrow phone screens.
    const scale = Math.min(1200 / brain.width, 690 / brain.height);
    const w = brain.width * scale, h = brain.height * scale;
    ctx.drawImage(brain, (1200 - w) / 2, 200 + (690 - h) / 2, w, h);
    ctx.font = '144px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText('🪰', 965, 200);

    ctx.save(); ctx.translate(920, 780); ctx.rotate(-0.08);
    ctx.strokeStyle = color; ctx.lineWidth = 7;
    ctx.strokeRect(-180, -85, 350, 185);
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.font = '88px Bungee, Impact, sans-serif'; ctx.fillText(`${result.score}%`, -5, -74);
    ctx.font = '25px Bungee, Impact, sans-serif'; ctx.fillText('BRAIN ROT', -5, 38);
    ctx.restore();

    ctx.fillStyle = '#f4f1e8'; ctx.font = 'bold 36px system-ui, sans-serif';
    const titleLines = lines(ctx, result.title, 1090).slice(0, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, 54, 930 + i * 46));
    ctx.font = '26px system-ui, sans-serif'; ctx.fillStyle = '#b6ff3b';
    ctx.fillText(`${result.senses.length}/5 senses lit up`, 54, 1046);
    ctx.font = '24px system-ui, sans-serif'; ctx.fillStyle = '#9d9db3';
    ctx.fillText(result.senses.join(' · '), 54, 1086);
    ctx.fillStyle = '#f4f1e8'; ctx.font = 'bold 27px system-ui, sans-serif';
    ctx.fillText('brainrotposts.com', 54, 1142);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9d9db3'; ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Can you hit 100%?', 1146, 1142);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png'));
  }
  window.BrainRotImage = { capture, render };
})();
