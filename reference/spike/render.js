(function (root) {
  const { W, H, GROUND } = root.Drew;
  function drawStickGuy(ctx, x, y, dead, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -30, 8, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 0); ctx.moveTo(0, -16); ctx.lineTo(-9, -6); ctx.moveTo(0, -16); ctx.lineTo(9, -6);
    ctx.moveTo(0, 0); ctx.lineTo(-7, 18); ctx.moveTo(0, 0); ctx.lineTo(7, 18); ctx.stroke();
    if (dead) { ctx.strokeStyle = '#E23B2E'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(14, -16); ctx.moveTo(14, -44); ctx.lineTo(-14, -16); ctx.stroke(); }
    ctx.restore();
  }
  function render(ctx, world, opts = {}) {
    ctx.save();
    ctx.fillStyle = '#F4F1E8'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); world.groundPts.forEach((g, i) => i ? ctx.lineTo(g.x, g.y + 4) : ctx.moveTo(g.x, g.y + 4)); ctx.stroke();
    if (world.goalX != null) { ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(world.goalX, GROUND); ctx.lineTo(world.goalX, GROUND - 90); ctx.stroke(); ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.moveTo(world.goalX, GROUND - 90); ctx.lineTo(world.goalX + 40, GROUND - 76); ctx.lineTo(world.goalX, GROUND - 62); ctx.fill(); }
    // creatures
    const P = world.P;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const st of world.strokes || []) {
      ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 7;
      ctx.beginPath(); let pen = false;
      st.links.forEach((c) => {
        if (c.broken) { pen = false; return; }
        const a = P[c.a], b = P[c.b];
        if (!pen) { ctx.moveTo(a.x, a.y); pen = true; }
        ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();
    }
    for (const cr of world.creatures) {
      const hp = world.headPos(cr);
      const r = Math.max(5, Math.min(14, cr.head.r * 0.32));
      const gap = r * 1.15;
      const lx = cr.look.x - hp.x, ly = cr.look.y - hp.y; const ld = Math.hypot(lx, ly) || 1;
      for (const sx of [-1, 1]) {
        const ex = hp.x + sx * gap, ey = hp.y - (cr.head.ids.length > 1 ? 0 : 14);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + lx / ld * r * 0.45, ey + ly / ld * r * 0.5, r * 0.45, 0, Math.PI * 2); ctx.fill();
        // brows by mode
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath();
        if (cr.mode === 'intercept') { ctx.moveTo(ex - r * sx * 1.0, ey - r * 1.7); ctx.lineTo(ex + r * sx * 0.9, ey - r * 1.25); }
        else { ctx.moveTo(ex - r, ey - r * 1.6); ctx.lineTo(ex + r, ey - r * 1.6); }
        ctx.stroke();
      }
      if (opts.labels) { ctx.fillStyle = '#7FB2E5'; ctx.font = '22px sans-serif'; ctx.fillText(cr.name + ' [' + cr.hands.length + 'H ' + cr.feet.length + 'F] ' + cr.mode, 14, 40 + cr.id * 26); }
      if (opts.debug) {
        for (const l of cr.hands) { const p = P[l.tip]; ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); }
        for (const l of cr.feet) { const p = P[l.tip]; ctx.fillStyle = '#22a55a'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); }
      }
    }
    for (const b of world.bodies) {
      if (!b.alive) continue;
      if (b.kind === 'bomb') {
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#E23B2E'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y - b.r); ctx.lineTo(b.x + 8, b.y - b.r - 12); ctx.stroke();
        ctx.fillStyle = '#E23B2E'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(Math.max(0, b.fuseAt - world.t).toFixed(1), b.x - 14, b.y - b.r - 18);
      }
    }
    for (const e of world.events) if (e.type === 'boom' && world.t - e.t < 0.5) { ctx.fillStyle = 'rgba(226,59,46,0.35)'; ctx.beginPath(); ctx.arc(e.x, e.y, 140, 0, 7); ctx.fill(); }
    if (world.ward) drawStickGuy(ctx, world.ward.x, world.ward.y, world.ward.dead);
    ctx.fillStyle = '#111'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('t=' + world.t.toFixed(1) + (world.failed ? '  FAIL' : ''), W - 200, 40);
    ctx.restore();
  }
  root.DrewRender = { render, drawStickGuy };
})(window);
