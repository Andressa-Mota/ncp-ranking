const API_URL = "http://127.0.0.1:8000/api";

// Navigation function
function goToPage(pageUrl) {
    if (pageUrl === 'menu.html') {
        const userType = localStorage.getItem('userType');
        if (userType === 'aluno') {
            const classId = localStorage.getItem('classId');
            if (classId) {
                window.location.href = 'turma.html?id=' + classId;
                return;
            }
        }
    }
    window.location.href = pageUrl;
}

document.addEventListener("DOMContentLoaded", () => {

    // Login Submission
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const errorMsg = document.getElementById("login-error");

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("userType", data.userType);
                    localStorage.setItem("username", data.username);
                    if (data.classId) {
                        localStorage.setItem("classId", data.classId);
                        window.location.href = "turma.html?id=" + data.classId;
                    } else {
                        window.location.href = "menu.html"; // Admin
                    }
                } else {
                    errorMsg.style.display = "block";
                }
            } catch (err) {
                errorMsg.textContent = "Erro ao conectar com o servidor!";
                errorMsg.style.display = "block";
            }
        });
    }

    // Load dynamic classes on the index menu
    const menuContainer = document.querySelector('.menu-buttons-container');
    if (menuContainer && window.location.pathname.includes("menu.html")) {
        menuContainer.innerHTML = '';

        const adminUsername = localStorage.getItem('username') || '';
        fetch(`${API_URL}/turmas?admin=${adminUsername}`)
            .then(res => res.json())
            .then(data => {
                data.turmas.forEach(c => {
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.display = 'inline-block';

                    const btn = document.createElement('button');
                    btn.className = 'class-btn';
                    btn.textContent = c.nome_turma;
                    btn.onclick = () => goToPage('turma.html?id=' + c.slug);

                    const deleteBtn = document.createElement('div');
                    deleteBtn.innerHTML = '✖';
                    deleteBtn.style.cssText = "position: absolute; top: -10px; right: -10px; background: red; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; font-weight: bold; font-family: sans-serif; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 10;";

                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation(); // Previne o clique de ir para a turma

                        // Alerta para perguntar se realmente quer excluir
                        if (confirm(`Tem certeza que deseja excluir a turma "${c.nome_turma}" e TODOS os dados e alunos dela do banco de dados? Essa ação é DEFINITIVA!`)) {
                            try {
                                const response = await fetch(`${API_URL}/turmas/${c.slug}?admin=${adminUsername}`, { method: 'DELETE' });
                                if (response.ok) {
                                    alert("Turma excluída com sucesso do banco de dados!");
                                    window.location.reload(); // Recarrega a página para remover o botão
                                } else {
                                    alert("Falha ao excluir a turma. Verifique a conexão.");
                                }
                            } catch (err) {
                                alert("Erro de conexão ao tentar excluir a turma.");
                            }
                        }
                    };

                    wrapper.appendChild(btn);
                    wrapper.appendChild(deleteBtn);
                    menuContainer.appendChild(wrapper);
                });
            })
            .catch(err => console.error("Sem conexão com o backend: ", err));
    }

    // Utils para converter foto em string local enxuta (Base64)
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve("");
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 250;
                    const MAX_HEIGHT = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    // Reduz qualidade jpeg pra 70% deixando o db levíssimo
                    resolve(canvas.toDataURL("image/jpeg", 0.7));
                };
                img.src = e.target.result;
            };
            reader.onerror = error => reject(error);
        });
    }

    // Save class and students via API
    const addClassForm = document.getElementById("add-class-form");
    if (addClassForm) {
        addClassForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const className = document.getElementById("class-name").value;

            const alunos = [];
            const studentBlocks = document.querySelectorAll('.student-block');

            for (let block of studentBlocks) {
                const nameInput = block.querySelector(`input[name^="student_name_"]`).value;
                const userInput = block.querySelector(`input[name^="student_user_"]`).value;
                const passInput = block.querySelector(`input[name^="student_pass_"]`).value;

                const imgInput = block.querySelector(`input[name^="student_img_"]`);
                let fotoBase64 = "";

                if (imgInput && imgInput.files && imgInput.files.length > 0) {
                    try {
                        fotoBase64 = await getBase64(imgInput.files[0]);
                    } catch (e) {
                        console.error("Erro ao converter foto", e);
                    }
                }

                alunos.push({
                    nome: nameInput,
                    usuario: userInput,
                    senha: passInput,
                    foto: fotoBase64
                });
            }

            const payload = {
                nome_turma: className,
                alunos: alunos,
                admin: localStorage.getItem('username') || 'Andressa'
            };

            try {
                const response = await fetch(`${API_URL}/turmas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    alert(`Turma "${className}" enviada para o MongoDB com sucesso!`);
                    goToPage('menu.html');
                } else {
                    alert("Erro ao salvar no banco!");
                }
            } catch (err) {
                alert("Servidor local não está rodando!");
            }
        });
    }
});

// Create student form fields
window.addStudentFields = function () {
    const container = document.getElementById('alunos-container');
    if (!container) return;

    // Unique ID for fields 
    const studentIdx = new Date().getTime();
    const block = document.createElement('div');
    block.className = 'student-block';
    block.innerHTML = `
        <button type="button" class="remove-btn" onclick="if(confirm('Tem certeza que deseja excluir este aluno?')) this.parentElement.remove()">X</button>
        <div class="student-row">
            <label>NOME:</label>
            <input type="text" name="student_name_${studentIdx}" placeholder="Nome do Aluno..." required autocomplete="off">
        </div>
        <div class="student-row">
            <label>FOTO:</label>
            <input type="file" name="student_img_${studentIdx}" accept="image/*">
        </div>
        <div class="student-row">
            <label>USUÁRIO:</label>
            <input type="text" name="student_user_${studentIdx}" placeholder="Criar user..." required autocomplete="off">
        </div>
        <div class="student-row">
            <label>SENHA:</label>
            <input type="text" name="student_pass_${studentIdx}" placeholder="Criar senha..." required>
        </div>
    `;

    container.appendChild(block);
    container.scrollTop = container.scrollHeight;
};

// Lógica do Seletor de Insígnias Sci-Fi
let currentBadgeStudentUser = "";
let currentBadgeIndex = -1;
let currentClassSlug = "";

window.openBadgeSelector = function(usuario, slotIndex) {
    currentBadgeStudentUser = usuario;
    currentBadgeIndex = slotIndex;
    let overlay = document.getElementById('global-badge-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-badge-overlay';
        overlay.className = 'badge-overlay-mask';
        overlay.innerHTML = `
            <div class="badge-picker-box">
                <div class="badge-picker-header">ESCOLHA UMA IMAGEM</div>
                <div style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center; width:100%;">
                    <div class="badge-option" style="background-image: url('images/comportamento.png')" onclick="applySelectedBadge('comportamento.png')"></div>
                    <div class="badge-option" style="background-image: url('images/eficiencia.png')" onclick="applySelectedBadge('eficiencia.png')"></div>
                    <div class="badge-option" style="background-image: url('images/notas.png')" onclick="applySelectedBadge('notas.png')"></div>
                    <div class="badge-option" style="background-image: url('images/presenca.png')" onclick="applySelectedBadge('presenca.png')"></div>
                    <div class="badge-option clear-btn" onclick="applySelectedBadge('')">X</div>
                </div>
                <div style="width:100%;text-align:center;margin-top:10px;">
                    <button onclick="document.getElementById('global-badge-overlay').style.display='none'" class="edit-btn-white-blue">CANCELAR</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
};

window.applySelectedBadge = async function(imageName) {
    document.getElementById('global-badge-overlay').style.display = 'none';
    if(currentBadgeStudentUser === "" || currentBadgeIndex === -1) return;
    
    const adminUsername = localStorage.getItem('username') || '';
    try {
        const slotContainer = document.getElementById(`badge-container-${currentBadgeStudentUser}`);
        let currentBadges = JSON.parse(slotContainer.getAttribute('data-badges') || '["","","",""]');
        currentBadges[currentBadgeIndex] = imageName;
        
        const response = await fetch(`${API_URL}/turmas/${currentClassSlug}/aluno/${currentBadgeStudentUser}/badges?admin=${adminUsername}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badges: currentBadges })
        });
        
        if (response.ok) {
            slotContainer.setAttribute('data-badges', JSON.stringify(currentBadges));
            const slot = slotContainer.children[currentBadgeIndex];
            if (imageName) {
                slot.style.backgroundImage = `url('images/${imageName}')`;
                slot.innerText = '';
            } else {
                slot.style.backgroundImage = 'none';
                slot.innerText = '+';
            }
        } else alert("Erro ao atualizar a imagem");
    } catch(e) {
        alert("Erro de conexão com o banco");
    }
};

// Global function to load rankings dynamically via params
window.loadClassRanking = async function (slug) {
    const adminUsername = localStorage.getItem('username') || '';
    const userType = localStorage.getItem('userType') || '';
    try {
        const response = await fetch(`${API_URL}/turmas/${slug}?admin=${adminUsername}&userType=${userType}`);
        if (!response.ok) throw new Error("Turma não encontrada");

        const data = await response.json();

        document.getElementById('turma-title').innerText = data.nome_turma.toUpperCase();
        const grid = document.getElementById('ranking-grid');
        grid.innerHTML = '';

        currentClassSlug = slug;

        data.alunos.forEach((aluno, index) => {
            const card = document.createElement('div');
            card.className = 'sci-fi-card';

            const trophyHtml = index === 0 ? `<div class="trophy" style="position: absolute; top:-20px; left:-10px; font-size:40px; z-index:10; filter: drop-shadow(0 0 5px gold);">🏆</div>` : '';

            const maxXP = 2050;
            const percentage = Math.min(100, Math.max(0, (aluno.xp_total / maxXP) * 100));
            const fotoUrl = aluno.foto || 'https://i.pinimg.com/736x/8b/16/7a/8b167af653c2399dd93b952a48740620.jpg';

            const isAdmin = userType === 'admin';
            
            const badgesArr = Array.isArray(aluno.badges) ? aluno.badges : ["", "", "", ""];
            let badgesHtml = "";
            for(let i=0; i<4; i++){
                const b = badgesArr[i];
                if(b) {
                   badgesHtml += `<div class="badge-slot ${!isAdmin ? 'read-only' : ''}" style="background-image: url('images/${b}')" ${isAdmin ? `onclick="openBadgeSelector('${aluno.usuario}', ${i})"` : ''}></div>`;
                } else if(isAdmin) {
                   badgesHtml += `<div class="badge-slot" onclick="openBadgeSelector('${aluno.usuario}', ${i})">+</div>`;
                } else {
                   badgesHtml += `<div class="badge-slot read-only"></div>`;
                }
            }

            card.innerHTML = `
                <div class="sci-fi-bg"></div>
                <div class="sci-fi-border"></div>
                ${trophyHtml}
                <div class="sci-fi-top-grid">
                    <div class="sci-fi-badges-left" id="badge-container-${aluno.usuario}" data-badges='${JSON.stringify(badgesArr)}'>
                        ${badgesHtml}
                    </div>
                    <div class="sci-fi-portrait-right">
                        <div class="avatar-sci-fi" style="background-image: url('${fotoUrl}')"></div>
                    </div>
                </div>
                <div class="student-name-pill" title="${aluno.nome.toUpperCase()}">${aluno.nome.toUpperCase()}</div>
                <div class="sci-fi-xp-row">
                    <div class="sci-fi-xp-bar-container">
                        <div class="sci-fi-xp-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="sci-fi-xp-label">XP</div>
                </div>
            `;
            grid.appendChild(card);
        });

        const headerRight = document.getElementById('header-right-actions');
        if (userType === 'admin' && headerRight) {
            let editBtn = document.getElementById('edit-class-btn');
            if (!editBtn) {
                editBtn = document.createElement('button');
                editBtn.id = 'edit-class-btn';
                editBtn.className = 'edit-btn-white-blue';
                editBtn.textContent = 'EDITAR TURMA';
                editBtn.onclick = () => goToPage('editar-turma.html?id=' + slug);
                headerRight.insertBefore(editBtn, headerRight.firstChild);

                let relatorioBtn = document.createElement('button');
                relatorioBtn.id = 'relatorio-class-btn';
                relatorioBtn.className = 'edit-btn-white-blue';
                relatorioBtn.textContent = 'RELATÓRIO';
                relatorioBtn.style.backgroundColor = '#f8b500';
                relatorioBtn.style.color = '#000';
                relatorioBtn.style.border = '1px solid #f8b500';
                relatorioBtn.style.marginRight = '10px';
                relatorioBtn.onclick = () => goToPage('relatorio.html?id=' + slug);
                headerRight.insertBefore(relatorioBtn, headerRight.firstChild);
            }
        }

    } catch (err) {
        document.getElementById('turma-title').innerText = "ERRO AO CARREGAR";
        console.error(err);
    }
};

// ==================================
// LÓGICA DE EDIÇÃO AVANÇADA (XP) MATRIZES
// ==================================

window.addNota = function (btnElem) {
    const container = btnElem.parentElement.nextElementSibling;
    const timeId = new Date().getTime();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 10px;";
    wrapper.innerHTML = `
        <span style="font-size: 8px;">N:</span>
        <input type="number" name="student_notas_${timeId}" style="background-color: transparent; border: 1px solid white; border-radius: 20px; color: white; padding: 2px 10px; font-family: 'Audiowide'; font-size: 10px; width: 50px; outline: none;">
        <span style="font-size: 8px;">Tent:</span>
        <input type="number" name="student_tentativas_${timeId}" placeholder="Qtd" style="background-color: transparent; border: 1px solid white; border-radius: 20px; color: white; padding: 2px 10px; font-family: 'Audiowide'; font-size: 10px; width: 50px; outline: none;">
    `;
    container.appendChild(wrapper);
};

window.addComp = function (btnElem) {
    const container = btnElem.parentElement.nextElementSibling;
    const select = document.createElement('select');
    select.name = `student_comp_${new Date().getTime()}`;
    select.style.cssText = "background: transparent; color: white; border: 1px solid white; border-radius: 20px; padding: 2px; font-family: 'Audiowide'; outline: none;";
    select.innerHTML = '<option value="bom" style="color: black;">Bom</option><option value="mal" style="color: black;">Mal</option>';
    container.appendChild(select);
};

window.addPresenca = function (btnElem) {
    const container = btnElem.parentElement.nextElementSibling;
    if (container.children.length >= 5) {
        alert("Máximo de 5 presenças permitidas por aluno.");
        return;
    }
    const timeId = new Date().getTime();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 10px;";
    wrapper.innerHTML = `
        <span style="font-size: 8px;">Dia:</span>
        <input type="date" name="student_presencas_${timeId}" style="background-color: transparent; border: 1px solid white; border-radius: 20px; color: white; padding: 2px 10px; font-family: 'Audiowide'; font-size: 10px; width: 110px; outline: none;">
    `;
    container.appendChild(wrapper);
};

// Removido addTeste pois agora é agrupado na Nota

// Template do bloco de aluno expandido
function buildExpandedStudentHTML(studentIdx, aluno = null) {
    const n = aluno ? aluno.nome : '';
    const u = aluno ? aluno.usuario : '';
    const p = aluno ? aluno.senha : '';
    const arrPresencas = aluno && Array.isArray(aluno.presencas) ? aluno.presencas : [];

    // Listas (Arrays) do BD
    const arrNotas = aluno && aluno.notas ? aluno.notas : [];
    const arrComps = aluno && aluno.comportamentos ? aluno.comportamentos : [];
    const arrTestes = aluno && aluno.testes_tentativas ? aluno.testes_tentativas : [];

    const formatInput = "background-color: transparent; border: 1px solid white; border-radius: 20px; color: white; padding: 2px 10px; font-family: 'Audiowide'; font-size: 10px; width: 50px; outline: none;";

    const maxNotas = Math.max(arrNotas.length, arrTestes.length);
    let htmlNotas = "";
    if (maxNotas > 0) {
        for (let i = 0; i < maxNotas; i++) {
            const notaVal = arrNotas[i] !== undefined ? arrNotas[i] : "";
            const tentativaVal = arrTestes[i] !== undefined ? arrTestes[i] : "";
            const id = new Date().getTime() + Math.random();
            htmlNotas += `
                <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 10px;">
                    <span style="font-size: 8px;">N:</span>
                    <input type="number" name="student_notas_${id}" value="${notaVal}" style="${formatInput}">
                    <span style="font-size: 8px;">Tent:</span>
                    <input type="number" name="student_tentativas_${id}" value="${tentativaVal}" placeholder="Qtd" style="${formatInput}">
                </div>
            `;
        }
    } else {
        htmlNotas = `
            <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 10px;">
                <span style="font-size: 8px;">N:</span>
                <input type="number" name="student_notas_${studentIdx}" style="${formatInput}">
                <span style="font-size: 8px;">Tent:</span>
                <input type="number" name="student_tentativas_${studentIdx}" placeholder="Qtd" style="${formatInput}">
            </div>
        `;
    }

    let htmlPresencas = "";
    arrPresencas.slice(0, 5).forEach((dataVal) => {
        const id = new Date().getTime() + Math.random();
        htmlPresencas += `
            <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 10px;">
                <span style="font-size: 8px;">Dia:</span>
                <input type="date" name="student_presencas_${id}" value="${dataVal}" style="${formatInput} width: 110px;">
            </div>
        `;
    });

    let htmlComps = arrComps.map(val => {
        const id = new Date().getTime() + Math.random();
        return `<select name="student_comp_${id}" style="background: transparent; color: white; border: 1px solid white; border-radius: 20px; padding: 2px; font-family: 'Audiowide'; outline: none;">
                    <option value="bom" style="color: black;" ${val === 'bom' ? 'selected' : ''}>Bom</option>
                    <option value="mal" style="color: black;" ${val === 'mal' ? 'selected' : ''}>Mal</option>
                </select>`;
    }).join('');

    if (!htmlComps) htmlComps = `<select name="student_comp_${studentIdx}" style="background: transparent; color: white; border: 1px solid white; border-radius: 20px; padding: 2px; font-family: 'Audiowide'; outline: none;"><option value="bom" style="color: black;">Bom</option><option value="mal" style="color: black;">Mal</option></select>`;

    return `
        <button type="button" class="remove-btn" onclick="if(confirm('Tem certeza que deseja excluir este aluno?')) this.parentElement.remove()">X</button>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <!-- Info Pessoal -->
            <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 10px;">
                <div class="student-row">
                    <label>NOME:</label>
                    <input type="text" name="student_name_${studentIdx}" value="${n}" required autocomplete="off">
                </div>
                <div class="student-row">
                    <label>USUÁRIO:</label>
                    <input type="text" name="student_user_${studentIdx}" value="${u}" required autocomplete="off">
                </div>
                <div class="student-row">
                    <label>SENHA:</label>
                    <input type="text" name="student_pass_${studentIdx}" value="${p}" required>
                </div>
                <div class="student-row">
                    <label>FOTO:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${aluno && aluno.foto ? aluno.foto : 'https://i.pinimg.com/736x/8b/16/7a/8b167af653c2399dd93b952a48740620.jpg'}" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid white;" />
                        <input type="file" name="student_img_${studentIdx}" accept="image/*" style="width: 130px;">
                    </div>
                </div>
            </div>
            
            <!-- Info XP Estatísticas Array -->
            <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; gap: 10px; border-left: 2px dashed #00c3ff; padding-left: 15px;">
                <div class="student-row" style="align-items: start; flex-direction: column; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
                    <label style="width: 100%">PRESENÇAS (Máx 5): 
                        <button type="button" onclick="addPresenca(this)" style="background:transparent; color: #f8b500; font-weight:bold; border:none; cursor:pointer;">[+ Dia]</button>
                    </label>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${htmlPresencas}</div>
                </div>

                <div class="student-row" style="align-items: start; flex-direction: column; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
                    <label style="width: 100%">NOTAS: 
                        <button type="button" onclick="addNota(this)" style="background:transparent; color: #f8b500; font-weight:bold; border:none; cursor:pointer;">[+ Add]</button>
                    </label>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${htmlNotas}</div>
                </div>
                
                <div class="student-row" style="align-items: start; flex-direction: column; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">
                    <label style="width: 100%">COMPORTAMENTO: 
                        <button type="button" onclick="addComp(this)" style="background:transparent; color: #f8b500; font-weight:bold; border:none; cursor:pointer;">[+ Dia]</button>
                    </label>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${htmlComps}</div>
                </div>
            </div>
        </div>
    `;
}

window.addExpandedStudentFields = function () {
    const container = document.getElementById('alunos-container');
    if (!container) return;
    const studentIdx = new Date().getTime();
    const block = document.createElement('div');
    block.className = 'student-block';
    block.style.background = 'rgba(0,0,0,0.3)';
    block.innerHTML = buildExpandedStudentHTML(studentIdx);
    container.appendChild(block);
    container.scrollTop = container.scrollHeight;
};

window.loadClassForEdit = async function (slug) {
    const adminUsername = localStorage.getItem('username') || '';
    const userType = localStorage.getItem('userType') || '';
    try {
        const response = await fetch(`${API_URL}/turmas/${slug}?admin=${adminUsername}&userType=${userType}`);
        if (!response.ok) throw new Error("Turma não encontrada para edição");
        const data = await response.json();

        document.getElementById('class-name').value = data.nome_turma;
        const container = document.getElementById('alunos-container');
        container.innerHTML = '';

        data.alunos.forEach(aluno => {
            const studentIdx = new Date().getTime() + Math.floor(Math.random() * 1000);
            const block = document.createElement('div');
            block.className = 'student-block';
            block.style.background = 'rgba(0,0,0,0.3)';
            block.dataset.oldFoto = aluno.foto || '';
            block.dataset.badges = JSON.stringify(aluno.badges || ["","","",""]);
            block.innerHTML = buildExpandedStudentHTML(studentIdx, aluno);
            container.appendChild(block);
        });

        const form = document.getElementById('edit-class-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const className = document.getElementById("class-name").value;
            const alunos = [];
            const studentBlocks = document.querySelectorAll('.student-block');

            for (let block of studentBlocks) {
                const nameInput = block.querySelector(`input[name^="student_name_"]`).value;
                const userInput = block.querySelector(`input[name^="student_user_"]`).value;
                const passInput = block.querySelector(`input[name^="student_pass_"]`).value;
                
                const arrayPresencas = [];
                block.querySelectorAll(`input[name^="student_presencas_"]`).forEach(el => {
                    if (el.value !== "") arrayPresencas.push(el.value);
                });

                // Scan Multi Arrays Note
                const arrayNotas = [];
                block.querySelectorAll(`input[name^="student_notas_"]`).forEach(el => {
                    if (el.value !== "") arrayNotas.push(parseInt(el.value));
                });
                // Scan Multi Arrays Comp
                const arrayComps = [];
                block.querySelectorAll(`select[name^="student_comp_"]`).forEach(el => {
                    arrayComps.push(el.value);
                });
                // Scan Multi Arrays Testes
                const arrayTestes = [];
                block.querySelectorAll(`input[name^="student_tentativas_"]`).forEach(el => {
                    if (el.value !== "") arrayTestes.push(parseInt(el.value));
                });

                const imgInput = block.querySelector(`input[name^="student_img_"]`);
                let fotoBase64 = block.dataset.oldFoto || '';
                if (imgInput && imgInput.files && imgInput.files.length > 0) {
                    try { fotoBase64 = await getBase64(imgInput.files[0]); } catch (e) { }
                }
                
                let savedBadges = ["","","",""];
                try {
                    if (block.dataset.badges) savedBadges = JSON.parse(block.dataset.badges);
                } catch(e) {}

                alunos.push({
                    nome: nameInput,
                    usuario: userInput,
                    senha: passInput,
                    foto: fotoBase64,
                    badges: savedBadges,
                    notas: arrayNotas,
                    presencas: arrayPresencas,
                    comportamentos: arrayComps,
                    testes_tentativas: arrayTestes
                });
            }

            const payload = { nome_turma: className, alunos: alunos };
            try {
                const res = await fetch(`${API_URL}/turmas/${slug}?admin=${adminUsername}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert("Turma e Ranking atualizados com absoluto sucesso!");
                    goToPage(`turma.html?id=${slug}`);
                } else alert("Falha na atualização");
            } catch (err) { alert("Erro fatal de servidor."); }
        };
    } catch (err) {
        alert("Erro ao carregar dados!!");
    }
};

window.loadReport = async function (slug) {
    const adminUsername = localStorage.getItem('username') || '';
    const userType = localStorage.getItem('userType') || '';
    try {
        const response = await fetch(`${API_URL}/turmas/${slug}?admin=${adminUsername}&userType=${userType}`);
        if (!response.ok) throw new Error("Turma não encontrada para relatório");
        const data = await response.json();

        document.getElementById('turma-title').innerText = data.nome_turma.toUpperCase();
        
        const alunos = data.alunos || [];
        if (alunos.length === 0) {
            document.getElementById('students-report-list').innerHTML = "<p style='color:white;text-align:center;'>Nenhum aluno nesta turma.</p>";
            return;
        }

        let somaTests = 0;
        let somaPresencas = 0;

        alunos.forEach(al => {
            const testList = Array.isArray(al.testes_tentativas) ? al.testes_tentativas : [];
            const presList = Array.isArray(al.presencas) ? al.presencas : [];
            somaTests += testList.reduce((a, b) => a + b, 0);
            somaPresencas += presList.length;
        });

        const avgTests = alunos.length > 0 ? somaTests / alunos.length : 0;
        const avgPresencas = alunos.length > 0 ? somaPresencas / alunos.length : 0;

        const metrics = alunos.map(al => {
            const arrNotas = Array.isArray(al.notas) ? al.notas : [];
            const arrTestes = Array.isArray(al.testes_tentativas) ? al.testes_tentativas : [];
            const arrPresencas = Array.isArray(al.presencas) ? al.presencas : [];
            const arrComps = Array.isArray(al.comportamentos) ? al.comportamentos : [];

            let validNotasSum = 0;
            let sumTestesTotal = 0;
            arrNotas.forEach((n, i) => {
                const t = arrTestes[i] || 0;
                sumTestesTotal += t;
                if (t <= 3 && n >= 70) validNotasSum += n;
            });

            let pL = arrPresencas.length;

            let compScore = 0;
            arrComps.forEach(c => {
                if(c==='bom') compScore+=10; 
                else if(c==='mal') compScore-=10;
            });

            return {
                nome: al.nome,
                notasVal: validNotasSum,
                testesVal: sumTestesTotal,
                presVal: pL,
                compVal: compScore
            };
        });

        const buildPodiumCol = (player, rank) => {
            const rLabel = rank === '1st' ? '1º' : rank === '2nd' ? '2º' : '3º';
            let fixedHeight = rank === '1st' ? 100 : rank === '2nd' ? 85 : 70;
            
            if (!player) return `
            <div class="podium-col" style="height: ${fixedHeight}%;">
                <div class="podium-text-container">
                    <span class="podium-name">-</span>
                    <span class="podium-val"></span>
                </div>
                <div class="podium-rank">${rLabel}</div>
            </div>`;
            
            return `
            <div class="podium-col" style="height: ${fixedHeight}%;">
                <div class="podium-text-container" title="${player.nome}">
                    <span class="podium-name">${player.nome.split(" ")[0]}</span>
                    <span class="podium-val">${player.val}</span>
                </div>
                <div class="podium-rank">${rLabel}</div>
            </div>`;
        };

        const renderPodium = (arr, valKey) => {
            const t = arr.slice(0, 3).map(x => ({ nome: x.nome, val: x[valKey] }));
            const first = t[0] || null;
            const second = t[1] || null;
            const third = t[2] || null;
            return buildPodiumCol(first, '1st') + buildPodiumCol(second, '2nd') + buildPodiumCol(third, '3rd');
        };

        const topNotasArr = [...metrics].sort((a,b) => b.notasVal - a.notasVal);
        const topPresArr = [...metrics].sort((a,b) => b.presVal - a.presVal);
        const topTestesArr = [...metrics].filter(x => x.notasVal > 0).sort((a,b) => a.testesVal - b.testesVal);
        const topCompArr = [...metrics].sort((a,b) => b.compVal - a.compVal);

        const rankingHtml = `
            <div class="stat-card red-theme">
                <div class="stat-title">MAIORES NOTAS</div>
                <div class="podium-container">
                    ${renderPodium(topNotasArr, 'notasVal')}
                </div>
            </div>
            <div class="stat-card green-theme">
                <div class="stat-title">MENOS TENTATIVAS</div>
                <div class="podium-container">
                    ${renderPodium(topTestesArr, 'testesVal')}
                </div>
            </div>
            <div class="stat-card purple-theme">
                <div class="stat-title">COMPORTAMENTO</div>
                <div class="podium-container">
                    ${renderPodium(topCompArr, 'compVal')}
                </div>
            </div>
            <div class="stat-card blue-theme">
                <div class="stat-title">MAIS PRESENÇAS</div>
                <div class="podium-container">
                    ${renderPodium(topPresArr, 'presVal')}
                </div>
            </div>
        `;
        document.getElementById('top-rankings').innerHTML = rankingHtml;

        let htmlList = "";
        alunos.forEach(al => {
            const arrNotas = Array.isArray(al.notas) ? al.notas : [];
            const arrTestes = Array.isArray(al.testes_tentativas) ? al.testes_tentativas : [];
            const arrPresencas = Array.isArray(al.presencas) ? al.presencas : [];
            const arrComps = Array.isArray(al.comportamentos) ? al.comportamentos : [];

            let notasDetailsHtml = "";
            let validNotasSum = 0;
            let sumTestesTotal = 0;

            const maxLen = Math.max(arrNotas.length, arrTestes.length);
            for(let i=0; i<maxLen; i++){
                const n = arrNotas[i] || 0;
                const t = arrTestes[i] || 0;
                sumTestesTotal += t;
                if(t > 3 || n < 70){
                    let reason = t > 3 ? "exceder 3 testes" : "ser menor que 70";
                    if(t > 3 && n < 70) reason = "testes ocultos e < 70";
                    notasDetailsHtml += `<div style="margin-bottom:5px;">Nota ${i+1}: <span style="text-decoration:line-through;color:#aaa;">${n}</span> (T: ${t}) <span style="color:#ff4d4d;font-size:11px;">- Desconsiderada por ${reason}!</span></div>`;
                } else {
                    validNotasSum += n;
                    notasDetailsHtml += `<div style="margin-bottom:5px;">Nota ${i+1}: <span style="color:#4da6ff;font-weight:bold;">${n}</span> (T: ${t}) - Válida</div>`;
                }
            }
            if(notasDetailsHtml === "") notasDetailsHtml = "Nenhuma nota registrada.";

            let colorTestes = (sumTestesTotal <= avgTests) ? '#00ff00' : '#ff4d4d';

            let compScore = 0;
            let compDetailsHtml = "";
            arrComps.forEach((c, idx) => {
                if(c==='bom') { compScore+=10; compDetailsHtml+=`Dia ${idx+1}: BOM (+10)<br>`; }
                else if(c==='mal') { compScore-=10; compDetailsHtml+=`Dia ${idx+1}: MAL (-10)<br>`; }
            });
            if(compDetailsHtml === "") compDetailsHtml = "Nenhum comportamento classificado.";

            let pL = arrPresencas.length;
            let colorPresencas = (pL >= avgPresencas) ? '#00ff00' : '#ff4d4d';

            htmlList += `
                <div class="report-accordion" onclick="toggleAccordion(this)">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${al.foto || 'https://i.pinimg.com/736x/8b/16/7a/8b167af653c2399dd93b952a48740620.jpg'}" style="width:30px; height:30px; border-radius:50%; border:1px solid #00c3ff;">
                        <span>${al.nome.toUpperCase()}</span>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="report-content">
                    <div style="display:flex; flex-wrap:wrap; gap:20px;">
                        <div style="flex:1; min-width:250px; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px;">
                            <h4 style="color:#00c3ff;margin-top:0;font-family:'Press Start 2P';font-size:10px;">NOTAS INDIVIDUAIS</h4>
                            <div style="font-family:sans-serif;font-size:14px;margin-bottom:10px;">
                                ${notasDetailsHtml}
                            </div>
                            <div style="font-weight:bold; color:#00ffaa; font-family:'Audiowide';">SOMA VÁLIDA: <span style="font-size:20px;">${validNotasSum}</span> XP</div>
                        </div>

                        <div style="flex:1; min-width:250px; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px;">
                            <h4 style="color:#00c3ff;margin-top:0;font-family:'Press Start 2P';font-size:10px;">ANÁLISE DE TENTATIVAS</h4>
                            <div style="font-family:sans-serif;font-size:14px;margin-bottom:10px;">
                                Ao todo, o aluno somou <strong style="color:${colorTestes};font-size:18px;">${sumTestesTotal}</strong> testes tentados nas atividades.<br>
                                <span style="font-size:12px;color:#aaa;">(Média da sala: ${avgTests.toFixed(1)})</span>
                            </div>

                            <h4 style="color:#00c3ff;margin-top:15px;font-family:'Press Start 2P';font-size:10px;">COMPORTAMENTO TOTAL</h4>
                            <div style="font-family:sans-serif;font-size:14px;margin-bottom:10px;">
                                ${compDetailsHtml}
                            </div>
                            <div style="font-weight:bold; color:${compScore>=0?'#00ffaa':'#ff4d4d'}; font-family:'Audiowide';">SALDO COMP.: <span style="font-size:20px;">${compScore}</span></div>

                            <h4 style="color:#00c3ff;margin-top:15px;font-family:'Press Start 2P';font-size:10px;">PRESENÇAS REGISTRADAS</h4>
                            <div style="font-family:sans-serif;font-size:14px;">
                                Dias marcados: <strong style="color:${colorPresencas};font-size:18px;">${pL}</strong><br>
                                <span style="font-size:12px;color:#aaa;">(Média da sala: ${avgPresencas.toFixed(1)})</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        document.getElementById('students-report-list').innerHTML = htmlList;

    } catch (err) {
        document.getElementById('turma-title').innerText = "ERRO AO CARREGAR RELATÓRIO";
        console.error(err);
    }
};
