// 飲む駅「みんなで入れるルーム」のサーバー側。
// ルーム1つ = Durable Object 1つが駅IDの配列を持つだけの最小実装。
// それ以外のパスは静的アセット（時間地図本体）をそのまま返す。
const MAX_STATIONS = 12;

function cleanStations(list) {
  const out = [];
  for (const value of Array.isArray(list) ? list : []) {
    const id = Number(value);
    if (Number.isInteger(id) && id >= 0 && id < 20000 && !out.includes(id)) out.push(id);
    if (out.length >= MAX_STATIONS) break;
  }
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export class NomuRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    let stations = (await this.state.storage.get('stations')) || [];
    if (request.method === 'GET') return json({ stations });
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (url.pathname.endsWith('/init')) {
        stations = cleanStations(body.stations);
      } else if (url.pathname.endsWith('/add')) {
        const id = Number(body.id);
        if (Number.isInteger(id) && id >= 0 && id < 20000
          && !stations.includes(id) && stations.length < MAX_STATIONS) stations.push(id);
      } else if (url.pathname.endsWith('/remove')) {
        stations = stations.filter(station => station !== Number(body.id));
      } else {
        return json({ error: 'not found' }, 404);
      }
      await this.state.storage.put('stations', stations);
      return json({ stations });
    }
    return json({ error: 'not found' }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(id));
      await stub.fetch('https://room/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stations: cleanStations(body.stations) }),
      });
      return json({ id });
    }
    const room = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{6,32})(\/(?:add|remove))?$/);
    if (room) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(room[1]));
      if (request.method === 'GET' && !room[2]) return stub.fetch('https://room/');
      if (request.method === 'POST' && room[2]) {
        return stub.fetch('https://room' + room[2], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: await request.text(),
        });
      }
      return json({ error: 'not found' }, 404);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
