// Install ws: npm install ws
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

let players = {}; // id -> {x,y,hp,dead,respawnTimer}
let bullets = []; // {x,y,dx,dy,owner}

const TICK = 1000/30; // 30 FPS

server.on('connection', ws => {
  const id = Math.random().toString(36).slice(2,9);
  players[id] = { x: 320, y: 240, hp: 100, dead: false, respawnTimer:0 };
  ws.id = id;

  ws.send(JSON.stringify({t:'init', id}));

  ws.on('message', msg=>{
    try{
      const d = JSON.parse(msg);
      const p = players[id];
      if(!p) return;
      if(d.t==='state' && !p.dead){
        p.x = d.x; p.y = d.y;
      }
      if(d.t==='shoot' && !p.dead){
        const b = {x:d.x, y:d.y, dx:d.dx, dy:d.dy, owner:id};
        bullets.push(b);
      }
    }catch(e){}
  });

  ws.on('close', ()=>{
    delete players[id];
  });
});

// --- Game loop ---
setInterval(()=>{
  const now = Date.now();
  // Move bullets
  bullets.forEach(b=>{
    b.x += b.dx*TICK/1000;
    b.y += b.dy*TICK/1000;
    // Check collision
    for(const pid in players){
      const p = players[pid];
      if(p.dead || pid===b.owner) continue;
      if(b.x > p.x-10 && b.x < p.x+10 && b.y > p.y-10 && b.y < p.y+10){
        p.hp -= 20;
        if(p.hp <= 0){
          p.dead = true;
          p.respawnTimer = now + 3000;
        }
        b.hit = true;
      }
    }
  });

  bullets = bullets.filter(b=>!b.hit && b.x>=0 && b.x<=640 && b.y>=0 && b.y<=480);

  // Handle respawn
  for(const pid in players){
    const p = players[pid];
    if(p.dead && now >= p.respawnTimer){
      p.dead = false;
      p.hp = 100;
      p.x = 320;
      p.y = 240;
    }
  }

  // Broadcast state
  const state = {t:'state', players, bullets};
  const str = JSON.stringify(state);
  server.clients.forEach(c=>{
    if(c.readyState===WebSocket.OPEN) c.send(str);
  });

}, TICK);

console.log("WebSocket server running on ws://localhost:8080");
