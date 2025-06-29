document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/enheter')
        .then(res => res.json())
        .then(enheter => renderEnheter(enheter));
});

function renderEnheter(enheter) {
    const list = document.getElementById('enhet-list');
    // Remove old rows except header
    list.querySelectorAll('.enhet-row').forEach(e => e.remove());
    enheter.forEach(row => {
        const form = document.createElement('form');
        form.className = 'enhet-row';
        form.action = '/oppdater-enhet';
        form.method = 'POST';

        // Parse battery health as percent (number)
        let batteriValue = parseFloat((row["batteri-helse"] || '').toString().replace(/[^\d.]/g, ''));
        let batteriColor = '';
        if (!isNaN(batteriValue)) {
            if (batteriValue < 30) {
                batteriColor = 'rgba(220, 53, 69, 0.5)'; // red
            } else if (batteriValue < 80) {
                batteriColor = 'rgba(255, 165, 0, 0.5)'; // orange
            } else {
                batteriColor = 'rgba(40, 167, 69, 0.5)'; // green
            }
        }

        form.innerHTML = `
            <input type="hidden" name="id" value="${row.ID}" />
            <div><input type="text" name="modell" value="${row.modell}" required /></div>
            <div><input type="text" name="batteri-helse" value="${row["batteri-helse"] || ''}" required style="background:${batteriColor};" /></div>
            <div><input type="text" name="serienummer" value="${row.serienummer}" required /></div>
            <div>
                <select name="status" required>
                    <option value="ulevert" ${row.status === 'ulevert' ? 'selected' : ''}>Ulevert</option>
                    <option value="mottatt" ${row.status === 'mottatt' ? 'selected' : ''}>Mottatt</option>
                    <option value="under arbeid" ${row.status === 'under arbeid' ? 'selected' : ''}>Under arbeid</option>
                    <option value="ferdig" ${row.status === 'ferdig' ? 'selected' : ''}>Ferdig</option>
                </select>
            </div>
            <div>
                <select name="skjerm-størrelse" required>
                    <option value="1920x1080" ${row["skjerm-størrelse"] === '1920x1080' ? 'selected' : ''}>1920x1080</option>
                    <option value="1680x1050" ${row["skjerm-størrelse"] === '1680x1050' ? 'selected' : ''}>1680x1050</option>
                    <option value="1280x720" ${row["skjerm-størrelse"] === '1280x720' ? 'selected' : ''}>1280x720</option>
                </select>
            </div>
            <div style="display: flex; gap: 0.5em;">
                <button class="save" type="submit">Lagre</button>
            </div>
        `;
        form.onsubmit = async function(e) {
            e.preventDefault();
            const data = new URLSearchParams(new FormData(form));
            await fetch('/oppdater-enhet', { method: 'POST', body: data });
            fetch('/api/enheter').then(res => res.json()).then(renderEnheter);
        };
        list.appendChild(form);

        // Delete button
        const deleteForm = document.createElement('form');
        deleteForm.className = 'inline';
        deleteForm.action = '/slett-enhet';
        deleteForm.method = 'POST';
        deleteForm.onsubmit = async function(e) {
            e.preventDefault();
            if (!confirm('Slette denne enheten?')) return;
            const data = new URLSearchParams();
            data.append('id', row.ID);
            await fetch('/slett-enhet', { method: 'POST', body: data });
            fetch('/api/enheter').then(res => res.json()).then(renderEnheter);
        };
        deleteForm.innerHTML = `<input type="hidden" name="id" value="${row.ID}" /><button class="delete" type="submit">Slett</button>`;
        form.lastElementChild.appendChild(deleteForm);
    });
}
