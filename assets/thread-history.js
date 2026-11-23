window.AttachLinkThreadHistory = (request, onError) => {
    let peer = null;
    let latest = null;
    let older = [];
    let cursor = null;
    let loadedPage = false;
    let generation = 0;
    const view = () => {
        const seen = new Set(latest.messages.map(message => String(message.id)));
        return {...latest, messages: [...latest.messages, ...older.filter(message => !seen.has(String(message.id)))],
            next_before: loadedPage ? cursor : latest.next_before};
    };
    return {
        select(id) {
            if (peer === id) return;
            peer = id;
            latest = null;
            older = [];
            cursor = null;
            loadedPage = false;
            generation++;
        },
        update(data) {
            if (latest && loadedPage) {
                const latestIds = new Set(data.messages.map(message => String(message.id)));
                older = [...latest.messages.filter(message => !latestIds.has(String(message.id))), ...older];
            }
            latest = data;
            return view();
        },
        addButton(container, data, render) {
            if (!data.next_before) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Load older messages';
            button.style.textDecoration = 'underline';
            container.prepend(button);
            button.onclick = async () => {
                button.disabled = true;
                const current = generation;
                try {
                    const path = 'messages.php?with='+encodeURIComponent(peer)+'&before='+encodeURIComponent(data.next_before);
                    const page = await request(path);
                    if (current !== generation) return;
                    older.push(...page.messages);
                    cursor = page.next_before;
                    loadedPage = true;
                    render(view(), true);
                } catch (error) {
                    if (current === generation) onError(error.message);
                } finally { button.disabled = false; }
            };
        }
    };
};
