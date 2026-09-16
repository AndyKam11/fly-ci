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
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export is unavailable in this browser.');
    const color = result.score < 30 ? '#ff5a5a' : '#b6ff3b';
    ctx.fillStyle = '#08080d'; ctx.fillRect(0, 0, 1200, 630);
    ctx.textBaseline = 'top';
    ctx.font = '48px Bungee, Impact, sans-serif';
    ctx.fillStyle = '#f4f1e8'; ctx.fillText('BRAIN', 36, 24);
    const brandWidth = ctx.measureText('BRAIN ').width;
    ctx.fillStyle = '#b6ff3b'; ctx.fillText('ROT', 36 + brandWidth, 24);
    ctx.font = '23px system-ui, sans-serif'; ctx.fillStyle = '#9d9db3';
    ctx.fillText('A fruit fly brain rated my LinkedIn post.', 36, 90);
    const scale = Math.min(730 / brain.width, 435 / brain.height);
    const w = brain.width * scale, h = brain.height * scale;
    ctx.drawImage(brain, 20 + (730 - w) / 2, 132 + (435 - h) / 2, w, h);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '96px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText('🪰', 1040, 22);
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.strokeRect(790, 155, 355, 150);
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.font = '76px Bungee, Impact, sans-serif'; ctx.fillText(`${result.score}%`, 968, 164);
    ctx.font = '23px Bungee, Impact, sans-serif'; ctx.fillText('BRAIN ROT', 968, 259);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f4f1e8'; ctx.font = 'bold 25px system-ui, sans-serif';
    const titleLines = lines(ctx, result.title, 365).slice(0, 3);
    titleLines.forEach((line, i) => ctx.fillText(line, 790, 331 + i * 32));
    ctx.font = '24px system-ui, sans-serif'; ctx.fillStyle = '#b6ff3b';
    ctx.fillText(`${result.senses.length}/5 senses lit up`, 790, 445);
    ctx.font = '18px system-ui, sans-serif'; ctx.fillStyle = '#9d9db3';
    lines(ctx, result.senses.join(' · '), 365).slice(0, 2).forEach((line, i) => ctx.fillText(line, 790, 485 + i * 26));
    ctx.fillStyle = '#f4f1e8'; ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('brainrotposts.com', 36, 584);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9d9db3'; ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Can you hit 100%?', 1164, 584);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png'));
  }
  window.BrainRotImage = { capture, render };
})();
