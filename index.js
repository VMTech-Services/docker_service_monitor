const express = require('express');
const Docker = require('dockerode');
const path = require('path');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PORT = process.env.PORT || 3000;

app.get('/', path.join(__dirname, 'webpage', 'index.html'))

app.use('/', express.static(path.join(__dirname, 'webpage')));

app.get('/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const simplified = containers.map(c => ({
            id: c.Id,
            name: c.Names[0].replace('/', ''),
            image: c.Image,
            state: c.State,
            status: c.Status,
        }));
        res.json(simplified);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка получения контейнеров', details: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
