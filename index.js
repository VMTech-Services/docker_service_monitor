const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Docker = require('dockerode');
const path = require('path');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 3000;

// Статика
app.use('/', express.static(path.join(__dirname, 'webpage')));

// HTTP + WebSocket сервер
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Вспомогалка: собрать упрощённый объект из полного описания
async function simplifyContainerInfo(inspectData) {
    const { Id, Name, Config, State, Created, NetworkSettings, HostConfig, Mounts, Image } = inspectData;
    return {
        id: Id,
        name: Name.replace('/', ''),
        image: Config.Image,
        command: Config.Cmd ? Config.Cmd.join(' ') : '',
        created: Created,
        state: State.Status,
        status: State.Health?.Status || State.Status,
        exitCode: State.ExitCode,
        ports: NetworkSettings.Ports,
        mounts: Mounts.map(m => ({ source: m.Source, dest: m.Destination, mode: m.RW ? 'rw' : 'ro' })),
        restartCount: State.Restarting ? State.RestartCount : 0,
        labels: Config.Labels || {}
    };
}

// Отправить всем клиентам сообщение
function broadcast(msg) {
    const json = JSON.stringify(msg);
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
    });
}

// При новом WS-подключении шлём initial snapshot
wss.on('connection', async ws => {
    try {
        const list = await docker.listContainers({ all: true });
        const fullInfos = await Promise.all(
            list.map(c => docker.getContainer(c.Id).inspect().then(simplifyContainerInfo))
        );
        ws.send(JSON.stringify({ type: 'initial', data: fullInfos }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
});

// Слушаем Docker-события  
docker.getEvents({}, (err, stream) => {
    if (err) return console.error('Docker events error:', err);
    stream.on('data', async chunk => {
        try {
            const event = JSON.parse(chunk.toString());
            if (event.Type === 'container') {
                // При любом событии контейнера — шлём обновлённую инфу по нему
                const info = await docker.getContainer(event.id).inspect().then(simplifyContainerInfo);
                broadcast({ type: 'update', data: info });
            }
        } catch (e) {
            console.error('Error handling event:', e);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
