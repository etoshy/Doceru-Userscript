// ==UserScript==
// @name         Docer.ar & Docubra.com Downloader (by Etoshy)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Intercepta a requisição do link de download e adiciona um botão para baixar o arquivo na mesma aba.
// @author       Etoshy
// @match        https://docer.ar/doc/*
// @match        https://docubra.com/doc/*
// @icon         https://cdn-icons-png.flaticon.com/512/126/126472.png
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[Etoshy Downloader v1.6]';
    console.log(`${SCRIPT_PREFIX} Script iniciado. Armadilha dupla (Fetch & XHR) preparada.`);

    const BUTTON_ID = 'etoshy-downloader-btn';
    const BUTTON_CONTAINER_SELECTOR = '#action-panel-details .dwn-contain';

    // --- ESTILOS (com a fonte ajustada e barra de progresso) ---
    GM_addStyle(`
        #${BUTTON_ID} {
            background-color: #04BB9C !important;
            color: white !important;
            border: none;
            border-radius: 4px;
            padding: 12px;
            width: 100%;
            text-align: center;
            font-family: 'YouTube Noto', 'Roboto', 'Arial', sans-serif;
            cursor: pointer;
            display: block;
            text-decoration: none;
            margin-bottom: 10px;
            transition: background-color 0.3s;
            position: relative;
            overflow: hidden;
        }
        #${BUTTON_ID}:hover { background-color: #03a086 !important; }
        #${BUTTON_ID} .main-text {
            font-size: 1.2em;
            font-weight: bold;
            display: block;
            position: relative;
            z-index: 2;
        }
        #${BUTTON_ID} .sub-text {
            font-size: 0.8em;
            font-weight: normal;
            display: block;
            margin-top: 4px;
            opacity: 0.9;
            position: relative;
            z-index: 2;
        }
        #${BUTTON_ID}:disabled {
            background-color: #cccccc !important;
            cursor: not-allowed;
        }
        #${BUTTON_ID} .progress-bar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.2);
            transition: width 0.3s ease;
            border-radius: 4px;
            z-index: 1;
        }
        #${BUTTON_ID} .progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.1em;
            font-weight: bold;
            z-index: 3;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            color: white;
        }
    `);

    // --- FUNÇÕES DO BOTÃO ---

    /**
     * Extrai o nome do arquivo da URL ou do título da página
     * @param {string} url - A URL do arquivo
     * @returns {string} - Nome do arquivo extraído
     */
    function extractFileName(url) {
        try {
            // Primeiro, tenta extrair da URL
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);

            // Se encontrou um nome válido na URL, usa ele
            if (fileName && fileName.indexOf('.') !== -1) {
                return decodeURIComponent(fileName);
            }

            // Se não encontrou na URL, tenta extrair do título da página
            const pageTitle = document.title;
            if (pageTitle && pageTitle.trim() !== '') {
                // Remove caracteres inválidos para nomes de arquivo
                const cleanTitle = pageTitle
                    .replace(/[<>:"/\\|?*]/g, '') // Remove caracteres inválidos
                    .replace(/\s+/g, ' ') // Normaliza espaços
                    .trim();

                if (cleanTitle.length > 0) {
                    return cleanTitle + '.pdf'; // Adiciona extensão padrão
                }
            }

            // Último recurso: tenta extrair do meta título ou h1
            const h1Element = document.querySelector('h1');
            if (h1Element && h1Element.textContent.trim()) {
                const cleanH1 = h1Element.textContent
                    .replace(/[<>:"/\\|?*]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (cleanH1.length > 0) {
                    return cleanH1 + '.pdf';
                }
            }

            return 'documento.pdf'; // nome padrão
        } catch (e) {
            console.warn(`${SCRIPT_PREFIX} Erro ao extrair nome do arquivo:`, e);
            return 'documento.pdf';
        }
    }

    /**
     * Tenta extrair o nome do documento dos elementos da página
     * @returns {string} - Nome do documento ou null se não encontrar
     */
    function extractDocumentNameFromPage() {
        // Seletores comuns para título de documento em sites como docer.ar e docubra.com
        const titleSelectors = [
            'h1.document-title',
            'h1',
            '.document-name',
            '.doc-title',
            '.file-name',
            '[data-document-title]',
            '.title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent
                    .replace(/[<>:"/\\|?*]/g, '') // Remove caracteres inválidos
                    .replace(/\s+/g, ' ') // Normaliza espaços
                    .trim();

                if (title.length > 0) {
                    console.log(`${SCRIPT_PREFIX} Título encontrado no seletor '${selector}': ${title}`);
                    return title;
                }
            }
        }

        return null;
    }

    /**
     * Adiciona o crédito ao nome do arquivo
     * @param {string} originalName - Nome original do arquivo
     * @returns {string} - Nome do arquivo com crédito
     */
    function addCreditToFileName(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');

        if (lastDotIndex === -1) {
            // Arquivo sem extensão
            return `${originalName}_Github-Etoshy_`;
        }

        const nameWithoutExtension = originalName.substring(0, lastDotIndex);
        const extension = originalName.substring(lastDotIndex);

        return `${nameWithoutExtension}_Github-Etoshy_${extension}`;
    }

    /**
     * Atualiza a barra de progresso do botão
     * @param {number} percentage - Porcentagem do progresso (0-100)
     */
    function updateProgressBar(percentage) {
        const button = document.getElementById(BUTTON_ID);
        if (!button) return;

        let progressBar = button.querySelector('.progress-bar');
        let progressText = button.querySelector('.progress-text');

        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            button.appendChild(progressBar);
        }

        if (!progressText) {
            progressText = document.createElement('div');
            progressText.className = 'progress-text';
            button.appendChild(progressText);
        }

        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    /**
     * Função que baixa o arquivo do servidor e depois envia para o usuário com nome modificado
     * @param {string} url - A URL do arquivo a ser baixado
     */
    async function triggerDownload(url) {
        console.log(`${SCRIPT_PREFIX} Iniciando download para: ${url}`);

        const button = document.getElementById(BUTTON_ID);
        if (button) {
            button.disabled = true;
            button.innerHTML = ''; // Limpa o conteúdo do botão para mostrar apenas a barra de progresso
        }

        try {
            // 1. Baixar o arquivo do servidor com controle de progresso
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Obter o tamanho total do arquivo
            const contentLength = response.headers.get('content-length');
            const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

            // 2. Obter o nome original do arquivo
            let originalFileName = 'documento.pdf'; // padrão inicial

            // Tentar obter o nome do Content-Disposition header primeiro
            const contentDisposition = response.headers.get('content-disposition');
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (fileNameMatch && fileNameMatch[1]) {
                    originalFileName = fileNameMatch[1].replace(/['"]/g, '');
                    console.log(`${SCRIPT_PREFIX} Nome extraído do Content-Disposition: ${originalFileName}`);
                }
            }

            // Se não conseguiu do header, tenta extrair da página
            if (originalFileName === 'documento.pdf') {
                // Primeiro tenta dos elementos específicos da página
                const documentTitle = extractDocumentNameFromPage();
                if (documentTitle) {
                    originalFileName = documentTitle + '.pdf';
                    console.log(`${SCRIPT_PREFIX} Nome extraído dos elementos da página: ${originalFileName}`);
                } else {
                    // Se não conseguir, usa o método de extração da URL/título
                    originalFileName = extractFileName(url);
                    console.log(`${SCRIPT_PREFIX} Nome extraído do título da página: ${originalFileName}`);
                }
            }

            // 3. Ler o stream com controle de progresso
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            updateProgressBar(0);

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                // Atualizar barra de progresso
                if (totalSize > 0) {
                    const percentage = (receivedLength / totalSize) * 100;
                    updateProgressBar(percentage);
                } else {
                    // Se não souber o tamanho total, simula progresso
                    const simulatedProgress = Math.min(95, (receivedLength / 1024 / 1024) * 10); // 10% por MB
                    updateProgressBar(simulatedProgress);
                }
            }

            // 4. Combinar chunks em um blob
            const blob = new Blob(chunks);
            updateProgressBar(100);

            // 5. Criar nome modificado com crédito
            const modifiedFileName = addCreditToFileName(originalFileName);

            // 6. Criar link de download com nome modificado
            const link = document.createElement('a');
            const objectURL = URL.createObjectURL(blob);

            link.href = objectURL;
            link.download = modifiedFileName;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 7. Limpar o objeto URL para liberar memória
            URL.revokeObjectURL(objectURL);

            console.log(`${SCRIPT_PREFIX} Download concluído! Arquivo: ${modifiedFileName}`);

            // Resetar o botão após um pequeno delay para mostrar 100%
            setTimeout(() => {
                if (button) {
                    button.disabled = false;
                    button.innerHTML = `<span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;
                }
            }, 1000);

        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Erro durante o download:`, error);

            // Em caso de erro, tenta o método original
            console.log(`${SCRIPT_PREFIX} Tentando método de download alternativo...`);
            const link = document.createElement('a');
            link.href = url;
            link.download = addCreditToFileName('documento.pdf');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Resetar o botão
            if (button) {
                button.disabled = false;
                button.innerHTML = `<span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;
            }
        }
    }

    function processFoundUrl(fileUrl) {
        if (!fileUrl) {
            console.warn(`${SCRIPT_PREFIX} URL do arquivo não foi encontrada na resposta.`);
            return;
        }
        console.log(`${SCRIPT_PREFIX} URL do arquivo encontrada: ${fileUrl}`);
        waitForElementAndCreateButton(fileUrl);
    }

    function waitForElementAndCreateButton(downloadUrl) {
        if (document.getElementById(BUTTON_ID)) {
            console.log(`${SCRIPT_PREFIX} Botão já existe. Ignorando.`);
            return;
        }
        console.log(`${SCRIPT_PREFIX} Aguardando contêiner '${BUTTON_CONTAINER_SELECTOR}' aparecer...`);

        const intervalId = setInterval(() => {
            const container = document.querySelector(BUTTON_CONTAINER_SELECTOR);
            if (container) {
                clearInterval(intervalId);
                console.log(`${SCRIPT_PREFIX} Contêiner encontrado! Inserindo botão...`);
                createDownloadButton(container, downloadUrl);
            }
        }, 500);
    }

    function createDownloadButton(container, downloadUrl) {
        const downloadButton = document.createElement('button');
        downloadButton.id = BUTTON_ID;
        downloadButton.type = 'button';
        downloadButton.innerHTML = `<span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;

        // Adiciona o evento de clique que chama nossa função de download aprimorada
        downloadButton.addEventListener('click', () => {
            triggerDownload(downloadUrl);
        });

        container.prepend(downloadButton);
        console.log(`${SCRIPT_PREFIX} Botão de download inserido com sucesso!`);
    }

    // --- LÓGICA DE INTERCEPTAÇÃO (XMLHttpRequest) ---
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && url.includes('/start/show')) {
            console.log(`${SCRIPT_PREFIX} (XHR) Interceptada chamada para: ${url}`);
            this.addEventListener('load', function() {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const data = JSON.parse(this.responseText);
                        processFoundUrl(data?.response?.url);
                    } catch (e) {
                        console.error(`${SCRIPT_PREFIX} (XHR) Erro ao analisar JSON:`, e);
                    }
                }
            });
        }
        return originalXhrOpen.apply(this, [method, url, ...args]);
    };

    // --- LÓGICA DE INTERCEPTAÇÃO (Fetch) ---
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const requestInfo = args[0];
        const url = (typeof requestInfo === 'string') ? requestInfo : requestInfo.url;

        if (typeof url === 'string' && url.includes('/start/show')) {
            console.log(`${SCRIPT_PREFIX} (Fetch) Interceptada requisição para: ${url}`);
            try {
                const response = await originalFetch(...args);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();
                processFoundUrl(data?.response?.url);
                return response;
            } catch (error) {
                console.error(`${SCRIPT_PREFIX} (Fetch) Erro ao processar:`, error);
                return originalFetch(...args);
            }
        }
        return originalFetch(...args);
    };

})();
