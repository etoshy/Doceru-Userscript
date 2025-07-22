// ==UserScript==
// @name         Doceru.com Downloader (by Etoshy)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Intercepta a requisição do link de download e adiciona um botão para baixar o arquivo do doceru.com.
// @author       Etoshy
// @match        https://doceru.com/doc/*
// @icon         https://cdn-icons-png.flaticon.com/512/126/126472.png
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[Etoshy Doceru Downloader v1.1]';
    console.log(`${SCRIPT_PREFIX} Script iniciado para doceru.com`);

    const BUTTON_ID = 'etoshy-doceru-btn';
    const BUTTON_CONTAINER_SELECTOR = '.dwn-contain';

    // --- ESTILOS (com barra de progresso) ---
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
            font-size: 16px;
            position: relative;
            overflow: hidden;
        }
        #${BUTTON_ID}:hover {
            background-color: #03a086 !important;
        }
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
        #${BUTTON_ID} .icon {
            margin-right: 8px;
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

    // --- FUNÇÕES UTILITÁRIAS ---

    /**
     * Tenta extrair o nome do documento dos elementos da página
     * @returns {string} - Nome do documento ou null se não encontrar
     */
    function extractDocumentNameFromPage() {
        // Seletores específicos para doceru.com
        const titleSelectors = [
            'h1.document-title',
            'h1',
            '.doc-title',
            '.document-name',
            '.file-name',
            '[data-document-title]',
            '.title',
            '.doc-info h1',
            '.document-header h1'
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
                    button.innerHTML = `<i class="icon icon_download"></i> <span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;
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
                button.innerHTML = `<i class="icon icon_download"></i> <span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;
            }
        }
    }

    // --- FUNÇÕES DE CRIAÇÃO DO BOTÃO ---

    function processFoundUrl(fileUrl) {
        if (!fileUrl) {
            console.warn(`${SCRIPT_PREFIX} URL do arquivo não foi encontrada na resposta.`);
            return;
        }
        console.log(`${SCRIPT_PREFIX} URL do arquivo encontrada: ${fileUrl}`);
        window.lastFoundDownloadUrl = fileUrl; // Salva para uso posterior
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
        downloadButton.innerHTML = `<i class="icon icon_download"></i> <span class="main-text">Baixar Arquivo</span><span class="sub-text">Cortesia de Etoshy</span>`;

        // Adiciona o evento de clique que chama nossa função de download aprimorada
        downloadButton.addEventListener('click', () => {
            triggerDownload(downloadUrl);
        });

        // Insere o botão no topo do container (antes do botão original)
        container.insertBefore(downloadButton, container.firstChild);
        console.log(`${SCRIPT_PREFIX} Botão de download inserido com sucesso!`);
    }

    // --- LÓGICA DE INTERCEPTAÇÃO ---

    // Intercepta requisições XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        // Padrões de URL que podem conter o link de download no doceru.com
        const downloadPatterns = [
            '/download',
            '/start/show',
            '/get_file',
            '/file_download',
            '/pdf_download'
        ];

        if (typeof url === 'string' && downloadPatterns.some(pattern => url.includes(pattern))) {
            console.log(`${SCRIPT_PREFIX} (XHR) Interceptada chamada para: ${url}`);
            this.addEventListener('load', function() {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const data = JSON.parse(this.responseText);
                        // Tenta diferentes estruturas de resposta
                        const fileUrl = data?.response?.url || data?.url || data?.download_url || data?.file_url;
                        processFoundUrl(fileUrl);
                    } catch (e) {
                        console.error(`${SCRIPT_PREFIX} (XHR) Erro ao analisar JSON:`, e);
                        // Se não for JSON, talvez seja uma URL direta
                        if (this.responseText && this.responseText.startsWith('http')) {
                            processFoundUrl(this.responseText);
                        }
                    }
                }
            });
        }
        return originalXhrOpen.apply(this, [method, url, ...args]);
    };

    // Intercepta requisições Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const requestInfo = args[0];
        const url = (typeof requestInfo === 'string') ? requestInfo : requestInfo.url;

        const downloadPatterns = [
            '/download',
            '/start/show',
            '/get_file',
            '/file_download',
            '/pdf_download'
        ];

        if (typeof url === 'string' && downloadPatterns.some(pattern => url.includes(pattern))) {
            console.log(`${SCRIPT_PREFIX} (Fetch) Interceptada requisição para: ${url}`);
            try {
                const response = await originalFetch(...args);
                const clonedResponse = response.clone();

                try {
                    const data = await clonedResponse.json();
                    const fileUrl = data?.response?.url || data?.url || data?.download_url || data?.file_url;
                    processFoundUrl(fileUrl);
                } catch (e) {
                    // Se não for JSON, tenta como texto
                    const textResponse = await clonedResponse.text();
                    if (textResponse && textResponse.startsWith('http')) {
                        processFoundUrl(textResponse);
                    }
                }

                return response;
            } catch (error) {
                console.error(`${SCRIPT_PREFIX} (Fetch) Erro ao processar:`, error);
                return originalFetch(...args);
            }
        }
        return originalFetch(...args);
    };

    // Intercepta cliques no botão original para capturar a URL
    document.addEventListener('click', function(event) {
        const target = event.target;

        // Verifica se o clique foi no botão de download original
        if (target.id === 'dwn_btn' || target.closest('#dwn_btn')) {
            console.log(`${SCRIPT_PREFIX} Clique interceptado no botão original de download`);

            // Tenta extrair informações do botão
            const button = target.closest('#dwn_btn') || target;
            const dataId = button.getAttribute('data-id');

            if (dataId) {
                console.log(`${SCRIPT_PREFIX} Data-ID encontrado: ${dataId}`);
                // Aqui você pode construir a URL de download se souber o padrão
                // Por exemplo: https://doceru.com/download/${dataId}
            }
        }
    });

    // Também monitora mudanças no DOM para garantir que o botão seja adicionado
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const container = node.querySelector ? node.querySelector(BUTTON_CONTAINER_SELECTOR) : null;
                    if (container && !document.getElementById(BUTTON_ID)) {
                        console.log(`${SCRIPT_PREFIX} Container encontrado via MutationObserver`);
                        // Aguarda um pouco para garantir que temos a URL de download
                        setTimeout(() => {
                            if (window.lastFoundDownloadUrl) {
                                createDownloadButton(container, window.lastFoundDownloadUrl);
                            }
                        }, 1000);
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
