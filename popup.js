// popup.js — Pixiv 图片提取 v1.2

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const titleEl = document.getElementById('artwork-title');
    const authorEl = document.getElementById('artwork-author');
    const countEl = document.getElementById('artwork-count');
    const loadingEl = document.getElementById('loading');
    const errorState = document.getElementById('error-state');
    const errorMsg = document.getElementById('error-msg');
    const retryBtn = document.getElementById('retry-btn');
    const grid = document.getElementById('image-grid');
    const selectionInfo = document.getElementById('selection-info');
    const selectedCount = document.getElementById('selected-count');
    const totalCount = document.getElementById('total-count');
    const toggleAllBtn = document.getElementById('toggle-all-btn');
    const filenameSection = document.getElementById('filename-section');
    const filenameInput = document.getElementById('filename-input');
    const btnGroup = document.getElementById('btn-group');
    const downloadBtn = document.getElementById('download-btn');
    const zipBtn = document.getElementById('zip-btn');
    const statusText = document.getElementById('status-text');

    const STORAGE_KEY = 'pixiv_filename_template';
    const DEFAULT_TEMPLATE = 'pixiv_{id}_{author}_{title}_p{index}';

    let allImages = [];
    let currentArtworkId = null;
    let currentTitle = '';
    let currentAuthor = '';
    let selectedIndices = new Set();

    // ─── 初始化 ───
    filenameInput.value = localStorage.getItem(STORAGE_KEY) || '';
    doExtract();
    retryBtn.addEventListener('click', doExtract);

    // 保存文件名模板
    filenameInput.addEventListener('input', () => {
        localStorage.setItem(STORAGE_KEY, filenameInput.value);
    });

    // ─── 提取图片 ───
    async function doExtract() {
        header.style.display = 'none';
        grid.style.display = 'none';
        selectionInfo.style.display = 'none';
        filenameSection.style.display = 'none';
        btnGroup.style.display = 'none';
        errorState.style.display = 'none';
        loadingEl.style.display = '';
        statusText.textContent = '';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url?.includes('pixiv.net/artworks/')) {
                showError('请先打开 Pixiv 作品详情页');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract-images' });
            if (chrome.runtime.lastError) {
                showError('无法连接到页面，请刷新后重试');
                return;
            }
            if (!response?.success) {
                showError(response?.error || '提取失败');
                return;
            }

            titleEl.textContent = response.title;
            authorEl.textContent = response.author;
            countEl.textContent = `${response.pageCount} 张图片`;
            header.style.display = '';

            allImages = response.images;
            currentArtworkId = response.artworkId;
            currentTitle = response.title;
            currentAuthor = response.author;
            selectedIndices.clear();

            renderGrid(allImages);
            loadingEl.style.display = 'none';
            grid.style.display = '';
            selectionInfo.style.display = '';
            filenameSection.style.display = '';
            btnGroup.style.display = '';
            updateSelectionUI();
        } catch (err) {
            console.error('[Pixiv 提取] 异常:', err);
            showError('提取过程中发生错误');
        }
    }

    // ─── 渲染网格 ───
    function renderGrid(images) {
        grid.innerHTML = '';
        images.forEach((img, i) => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.innerHTML = `
                <img src="${img.previewUrl}" alt="图片 ${img.index}" loading="lazy">
                <div class="checkbox">✓</div>
                <div class="page-label">${img.index}/${images.length}</div>
            `;
            card.addEventListener('click', () => toggleSelect(i));
            grid.appendChild(card);
        });
    }

    // ─── 选中切换 ───
    function toggleSelect(index) {
        selectedIndices.has(index) ? selectedIndices.delete(index) : selectedIndices.add(index);
        updateSelectionUI();
    }

    function updateSelectionUI() {
        grid.querySelectorAll('.image-card').forEach((card, i) => {
            card.classList.toggle('selected', selectedIndices.has(i));
        });
        const count = selectedIndices.size;
        const total = allImages.length;
        selectedCount.textContent = count;
        totalCount.textContent = total;
        toggleAllBtn.textContent = count === total ? '取消全选' : '全选';
        downloadBtn.disabled = count === 0;
        downloadBtn.textContent = count > 0 ? `下载选中 (${count})` : '下载选中';
        zipBtn.disabled = count === 0;
        zipBtn.textContent = count > 0 ? `打包下载 (${count})` : '打包下载';
    }

    toggleAllBtn.addEventListener('click', () => {
        if (selectedIndices.size === allImages.length) {
            selectedIndices.clear();
        } else {
            allImages.forEach((_, i) => selectedIndices.add(i));
        }
        updateSelectionUI();
    });

    // ─── 文件名生成 ───
    function buildFilename(template, vars) {
        const t = template && template.trim() ? template.trim() : DEFAULT_TEMPLATE;
        return t
            .replace(/{id}/g, vars.id || 'unknown')
            .replace(/{author}/g, vars.author || 'unknown')
            .replace(/{title}/g, vars.title || 'unknown')
            .replace(/{index}/g, vars.index || '0')
            .replace(/[\\/:*?"<>|]/g, '_');
    }

    function getExtFromUrl(url) {
        return url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
    }

    // ─── 逐张下载 ───
    downloadBtn.addEventListener('click', async () => {
        if (selectedIndices.size === 0) return;
        const selected = [...selectedIndices].sort((a, b) => a - b);
        const template = filenameInput.value;
        downloadBtn.disabled = true;
        zipBtn.disabled = true;

        let ok = 0, fail = 0;
        for (let i = 0; i < selected.length; i++) {
            const img = allImages[selected[i]];
            setStatus(`正在下载 ${i + 1}/${selected.length}...`, 'info');
            try {
                const ext = getExtFromUrl(img.originalUrl);
                const filename = buildFilename(template, {
                    id: currentArtworkId, author: currentAuthor,
                    title: currentTitle, index: img.index
                }) + '.' + ext;
                await downloadFile(img.originalUrl, filename);
                ok++;
            } catch (err) {
                console.error(`[下载] 图片 ${img.index} 失败:`, err);
                fail++;
            }
        }

        setStatus(fail === 0
            ? `全部下载完成！共 ${ok} 张`
            : `完成：${ok} 成功，${fail} 失败`, fail > 0 ? 'error' : 'success');
        downloadBtn.disabled = false;
        zipBtn.disabled = false;
        updateSelectionUI();
    });

    // ─── 打包下载 ───
    zipBtn.addEventListener('click', async () => {
        if (selectedIndices.size === 0 || typeof JSZip === 'undefined') return;
        const selected = [...selectedIndices].sort((a, b) => a - b);
        const template = filenameInput.value;
        downloadBtn.disabled = true;
        zipBtn.disabled = true;

        try {
            const zip = new JSZip();
            const folderName = buildFilename(
                template.replace(/_p\{index\}$/i, '').replace(/\{index\}/g, ''),
                { id: currentArtworkId, author: currentAuthor, title: currentTitle }
            );
            const folder = zip.folder(folderName);

            for (let i = 0; i < selected.length; i++) {
                const img = allImages[selected[i]];
                setStatus(`正在打包 ${i + 1}/${selected.length}...`, 'info');
                const resp = await fetch(img.originalUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                const ext = getExtFromUrl(img.originalUrl);
                folder.file(`p${img.index}.${ext}`, blob);
            }

            setStatus('正在生成 ZIP...', 'info');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${folderName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            setStatus(`打包完成！共 ${selected.length} 张`, 'success');
        } catch (err) {
            console.error('[打包下载] 异常:', err);
            setStatus('打包下载失败', 'error');
        }

        downloadBtn.disabled = false;
        zipBtn.disabled = false;
        updateSelectionUI();
    });

    // ─── 下载工具 ───
    async function downloadFile(url, filename) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        await new Promise(r => setTimeout(r, 300));
    }

    // ─── 通用 ───
    function showError(msg) {
        loadingEl.style.display = 'none';
        errorState.style.display = '';
        errorMsg.textContent = msg;
    }

    function setStatus(text, type) {
        statusText.textContent = text;
        statusText.className = `status-text status-${type}`;
    }
});
