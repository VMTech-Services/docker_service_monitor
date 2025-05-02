const main = document.getElementById('main');
const containersMap = new Map();

// Функция для создания или обновления карточки контейнера
function upsertContainer(c) {
    let elem = containersMap.get(c.id);
    if (!elem) {
        // создаём новую карточку
        elem = document.createElement('div');
        elem.className = 'container';
        elem.dataset.id = c.id;
        containersMap.set(c.id, elem);
        main.appendChild(elem);
    }
    // наполняем содержимым
    elem.innerHTML = `
    <div class="header-field">
      <span class="label">${c.name}</span>
      <span class="status-indicator ${c.state}">${c.state}</span>
    </div>
    <div class="body-field">
      <div><strong>Image:</strong> ${c.image}</div>
      <div><strong>Command:</strong> ${c.command}</div>
      <div><strong>Created:</strong> ${new Date(c.created).toLocaleString()}</div>
      <div><strong>Status:</strong> ${c.status}</div>
      <div><strong>Exit Code:</strong> ${c.exitCode}</div>
      <div><strong>Ports:</strong> ${formatPorts(c.ports)}</div>
      <div><strong>Mounts:</strong> ${formatMounts(c.mounts)}</div>
    </div>
  `;
}

function formatPorts(ports) {
    if (!ports) return '-';
    return Object.entries(ports)
        .map(([containerPort, mappings]) =>
            mappings
                ? mappings.map(m => `${m.HostIp}:${m.HostPort}->${containerPort}`).join(', ')
                : `:${containerPort}`
        )
        .join('; ');
}

function formatMounts(mounts) {
    if (!mounts || mounts.length === 0) return '-';
    return mounts.map(m => `${m.source}:${m.dest} (${m.mode})`).join(', ');
}

// Открываем WS и подписываемся на сообщения
const ws = new WebSocket(`ws://${location.host}`);
ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'initial') {
        msg.data.forEach(upsertContainer);
    } else if (msg.type === 'update') {
        upsertContainer(msg.data);
    }
};
ws.onerror = console.error;
