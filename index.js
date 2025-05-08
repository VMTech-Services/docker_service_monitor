const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Docker = require('dockerode');
const path = require('path');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 3000;

app.use('/', express.static(path.join(__dirname, 'webpage')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранение логов контейнеров
const containerLogs = {};

async function simplifyContainerInfo(inspectData) {
    const { Id, Name, Config, Created, State } = inspectData;
    return {
        id: Id,
        name: Name.replace('/', ''),
        image: Config.Image,
        state: State.Status,
        created: Created,
        runningFor: State.Status === 'running'
            ? Math.floor((Date.now() - new Date(State.StartedAt).getTime()) / 1000)
            : 0
    };
}

function broadcast(msg) {
    const json = JSON.stringify(msg);
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
    });
}

wss.on('connection', async ws => {
    try {
        const list = await docker.listContainers({ all: true });
        const infos = await Promise.all(
            list.map(c => docker.getContainer(c.Id).inspect().then(simplifyContainerInfo))
        );
        ws.send(JSON.stringify({ type: 'initial', data: infos }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
});

docker.getEvents({}, (err, stream) => {
    if (err) return console.error('Docker events error:', err);

    stream.on('data', async chunk => {
        let event;
        try {
            event = JSON.parse(chunk.toString());
        } catch (e) {
            return;
        }
        if (event.Type !== 'container') return;

        const id = event.id || event.Actor?.ID;
        const action = event.Action;

        if (action === 'destroy') {
            return broadcast({ type: 'remove', id });
        }

        if (action === 'create' || action === 'start') {
            try {
                const info = await docker.getContainer(id).inspect().then(simplifyContainerInfo);
                return broadcast({ type: 'add', data: info });
            } catch (_) { return; }
        }

        try {
            const info = await docker.getContainer(id).inspect().then(simplifyContainerInfo);
            broadcast({ type: 'update', data: info });
        } catch (e) {
            console.error('Inspect error:', e);
        }

        // Получаем логи контейнера
        if (action === 'start' || action === 'restart') {
            docker.getContainer(id).logs({
                follow: true,
                stdout: true,
                stderr: true
            }, (err, stream) => {
                if (err) return console.error(`Error fetching logs for container ${id}:`, err);

                stream.on('data', (data) => {
                    const log = data.toString();

                    // Сохраняем логи для контейнера
                    if (!containerLogs[id]) {
                        containerLogs[id] = [];
                    }
                    containerLogs[id].push(log);

                    // Ограничиваем логи до 50 последних записей
                    if (containerLogs[id].length > 50) {
                        containerLogs[id].shift(); // Удаляем самый старый лог
                    }

                    // Отправляем новый лог клиентам
                    broadcast({
                        type: 'log',
                        id,
                        log
                    });
                });
            });
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
