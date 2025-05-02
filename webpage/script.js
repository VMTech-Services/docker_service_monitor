const main = document.getElementById('main');
const containersMap = new Map();

function upsertContainer(c) {
    let record = containersMap.get(c.id);

    if (!record) {
        const elem = document.createElement('div');
        elem.className = 'container';
        elem.dataset.id = c.id;

        elem.innerHTML = `
      <div class="header-field">
        <span class="label"></span>
        <span class="status-indicator"></span>
      </div>
      <div class="body-field">
        <div><strong>Image:</strong> <span class="val-image"></span></div>
        <div><strong>Created:</strong> <span class="val-created"></span></div>
        <div><strong>Uptime:</strong> <span class="val-uptime"></span></div>
      </div>
    `;
        main.appendChild(elem);

        record = { elem, data: {} };
        containersMap.set(c.id, record);
    }

    record.data = { ...c };

    const { elem, data } = record;
    elem.querySelector('.label').innerText = data.name;
    const statusEl = elem.querySelector('.status-indicator');
    statusEl.className = `status-indicator ${data.state}`;
    statusEl.innerText = data.state;

    elem.querySelector('.val-image').innerText = data.image;
    elem.querySelector('.val-created').innerText = new Date(data.created).toLocaleString();
    elem.querySelector('.val-uptime').innerText = formatRunningFor(data.runningFor);
}

function removeContainer(id) {
    const record = containersMap.get(id);
    if (record) {
        record.elem.remove();
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

setInterval(() => {
    containersMap.forEach(({ elem, data }) => {
        if (data.state === 'running') {
            data.runningFor++;
            elem.querySelector('.val-uptime').innerText = formatRunningFor(data.runningFor);
        }
    });
}, 1000);

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
