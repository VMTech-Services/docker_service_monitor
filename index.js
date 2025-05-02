const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

docker.listContainers({ all: true }, (err, containers) => {
    if (err) {
        console.error('Ошибка при получении контейнеров:', err);
        return;
    }

    if (containers.length === 0) {
        console.log('Контейнеры не найдены.');
        return;
    }

    console.log('Список контейнеров:');
    containers.forEach(container => {
        console.log(`- ${container.Names[0]} [${container.State}]`);
    });
});
