(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = canvas.width, H = canvas.height;
  const ui = {
    start: document.getElementById('btnStart'),
    mode: document.getElementById('btnMode'),
    pause: document.getElementById('btnPause'),
    reset: document.getElementById('btnReset'),
    level: document.getElementById('level'),
    speed: document.getElementById('speed'),
    lives: document.getElementById('lives'),
    score: document.getElementById('score'),
  };

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(480, window.innerWidth);
    const h = window.innerHeight;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    canvas.width = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    W = canvas.width; H = canvas.height;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', fit);
  fit();

  const audio = {
    ctx: null,
    beep(freq, dur=0.07, type='sine', gain=0.04) {
      try{
        if(!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
        const t0 = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t0);
        g.gain.value = gain;
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t0);
        o.stop(t0+dur);
      }catch(e){}
    },
    good(){ this.beep(880,0.06,'sine',0.05); },
    bad(){ this.beep(200,0.12,'square',0.06); }
  };

  const state = {
    running: false,
    paused: false,
    mode: 'endless',
    level: 1,
    lives: 3,
    score: 0,
    speedMul: 1,
    rope: {
      ang: Math.PI * 1.5,
      speed: 2.6,
      radius: 120,
      length: 340,
      thickness: 6,
    },
    player: {
      x: 0, y: 0, r: 14,
      vy: 0, onGround: true,
      jumpForce: 8.6,
      gravity: 22,
    },
    arena: {
      cx: 0, cy: 0, groundY: 0,
    },
    combo: 0,
    lastTime: 0,
  };

  function resetArena(){
    state.arena.cx = W/2;
    state.arena.cy = H*0.48;
    state.arena.groundY = state.arena.cy + 110;
    state.player.x = state.arena.cx;
    state.player.y = state.arena.groundY - state.player.r;
    state.rope.radius = Math.min(160, Math.max(110, Math.min(W,H)*0.23));
    state.rope.length = state.rope.radius*2.3;
  }
  resetArena();

  function setMode(m){
    state.mode = m;
    ui.mode.textContent = 'Mode: ' + (m==='endless'?'Endless':'Levels');
    hardReset();
  }

  function hardReset(){
    state.level = 1;
    state.lives = 3;
    state.score = 0;
    state.speedMul = 1;
    state.rope.ang = Math.PI * 1.5;
    state.rope.speed = 2.6;
    state.combo = 0;
    updateUI();
  }

  function updateUI(){
    ui.level.textContent = state.level;
    ui.lives.textContent = state.lives;
    ui.score.textContent = state.score;
    ui.speed.textContent = state.speedMul.toFixed(1)+'x';
  }

  ui.start.addEventListener('click', ()=> { state.running = true; state.paused=false; ui.pause.textContent='Pause'; });
  ui.mode.addEventListener('click', ()=> setMode(state.mode==='endless'?'levels':'endless'));
  ui.pause.addEventListener('click', ()=> { state.paused = !state.paused; ui.pause.textContent = state.paused?'Resume':'Pause'; });
  ui.reset.addEventListener('click', ()=> { hardReset(); });

  function tryJump(){
    if(!state.running) state.running = true;
    if(state.paused) return;
    if(state.player.onGround){
      state.player.vy = -state.player.jumpForce;
      state.player.onGround = false;
    }
  }
  canvas.addEventListener('pointerdown', tryJump);
  window.addEventListener('keydown', (e)=>{
    if(e.code === 'Space') tryJump();
  });

  function tick(dt){
    state.speedMul += dt * 0.02;
    const ropeSpeed = state.rope.speed * state.speedMul;
    state.rope.ang += ropeSpeed * dt;

    if(!state.player.onGround){
      state.player.vy += state.player.gravity * dt;
      state.player.y += state.player.vy;
      if(state.player.y >= state.arena.groundY - state.player.r){
        state.player.y = state.arena.groundY - state.player.r;
        state.player.vy = 0;
        state.player.onGround = true;
      }
    }

    const ang = state.rope.ang % (Math.PI*2);
    const underPass = (ang > Math.PI/2 && ang < Math.PI/2 + ropeSpeed*dt*1.2);
    if(underPass){
      const clearance = (state.arena.groundY - state.player.y - state.player.r);
      if(clearance < state.rope.thickness*0.85){
        audio.bad();
        state.lives -= 1;
        state.combo = 0;
        state.speedMul = Math.max(1, state.speedMul * 0.92);
        if(state.lives <= 0){
          gameOver();
        }
        updateUI();
      } else {
        audio.good();
        state.combo += 1;
        const gained = 10 + Math.floor(state.combo*0.6);
        state.score += gained;
        if(state.mode==='levels' && state.combo % 10 === 0){
          state.level += 1;
          state.speedMul += 0.15;
          state.player.jumpForce += 0.1;
        }
        updateUI();
      }
    }
  }

  function gameOver(){
    state.running = false;
    state.paused = true;
    ui.pause.textContent = 'Resume';
  }

  function draw(){
    ctx.fillStyle = '#071018';
    ctx.fillRect(0,0,W,H);

    ctx.save();
    ctx.translate(0, state.arena.groundY+2);
    ctx.fillStyle = '#0e2036';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for(let x=0;x<W;x+=24){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(let y=0;y<H;y+=24){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    const cx = state.arena.cx;
    const cy = state.arena.cy;
    const r = state.rope.radius;
    const endx = cx + Math.cos(state.rope.ang) * r;
    const endy = cy + Math.sin(state.rope.ang) * r;

    ctx.strokeStyle = '#233a62';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(cx-160, cy-100); ctx.lineTo(cx-160, state.arena.groundY+20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+160, cy-100); ctx.lineTo(cx+160, state.arena.groundY+20); ctx.stroke();

    ctx.strokeStyle = '#b9d6ff';
    ctx.lineWidth = state.rope.thickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(endx, endy);
    ctx.stroke();

    ctx.globalAlpha = 0.25;
    for(let i=1;i<=8;i++){
      const a = state.rope.ang - i*0.15;
      const tx = cx + Math.cos(a)*r;
      const ty = cy + Math.sin(a)*r;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const shw = 28 + Math.min(16, Math.abs(state.arena.groundY - (p.y+p.r))*0.3);
    ctx.beginPath();
    ctx.ellipse(p.x, state.arena.groundY+2, shw, shw*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#ffdb7d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(p.x-10, p.y+p.r-2, 20, 28);
    ctx.fillStyle = '#2a4b84';
    ctx.fillRect(p.x-20, p.y+p.r+26, 12, 18);
    ctx.fillRect(p.x+8, p.y+p.r+26, 12, 18);

    if(!state.running){
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.textAlign = 'center';
      ctx.fillText('Tap to Jump — Avoid the Rope!', W/2, H*0.5 - 40);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('Press Start to play. Mode toggles Endless/Levels.', W/2, H*0.5);
    } else if(state.paused){
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 26px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', W/2, H*0.45);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('Tap Resume to continue', W/2, H*0.5);
    }
  }

  let rafId = 0;
  function loop(ts){
    const t = ts/1000;
    const dt = Math.min(0.033, t - (state.lastTime||t));
    state.lastTime = t;
    if(state.running && !state.paused){
      tick(dt);
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }
  loop(0);

})();
