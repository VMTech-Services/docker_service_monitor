
const main = document.getElementById('main');
const containersMap = new Map();

function upsertContainer(c) {
    let elem = containersMap.get(c.id);

    if (!elem) {
        elem = document.createElement('div');
        elem.className = 'container';
        elem.dataset.id = c.id;
        containersMap.set(c.id, elem);
        main.appendChild(elem);
    }

    elem.innerHTML = `
    <div class="header-field">
      <span class="label">${c.name}</span>
      <span class="status-indicator ${c.state}">${c.state}</span>
    </div>
    <div class="body-field">
      <div><strong>Image:</strong> ${c.image}</div>
      <div><strong>Created:</strong> ${new Date(c.created).toLocaleString()}</div>
      <div><strong>Uptime:</strong> ${formatRunningFor(c.runningFor)}</div>
    </div>
  `;
}

function removeContainer(id) {
    const elem = containersMap.get(id);
    if (elem) {
        elem.remove();
        containersMap.delete(id);
    }
}

function formatRunningFor(sec) {
    if (sec <= 0) return '-';
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const ws = new WebSocket(`ws://${location.host}`);
ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    switch (msg.type) {
        case 'initial':
            msg.data.forEach(upsertContainer);
            break;
        case 'add':
        case 'update':
            upsertContainer(msg.data);
            break;
        case 'remove':
            removeContainer(msg.id);
            break;
    }
};
ws.onerror = console.error;
