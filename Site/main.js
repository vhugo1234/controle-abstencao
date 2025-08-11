// Firebase Configuração
const firebaseConfig = {
  apiKey: "AIzaSyB8fau_vw1jRZW-oXDK3qXqRVGVQrY64aA",
  authDomain: "abstencao-d812a.firebaseapp.com",
  databaseURL: "https://abstencao-d812a-default-rtdb.firebaseio.com/",
  projectId: "abstencao-d812a",
  storageBucket: "abstencao-d812a.appspot.com",
  messagingSenderId: "782397493062",
  appId: "1:782397493062:web:d1ef16ace5548afa2c5f47",
  measurementId: "G-34FG6G6W5V"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let dados = [];
let eventos = [];
let turnos = [];
let escolas = [];
let usuarioAtual = null;
let ehAdmin = false;
let ehCoord = false;

let motivosDesistentes = [];
let motivosEliminados = [];

// ===== AUTENTICAÇÃO EMAIL/SENHA =====
document.getElementById("loginBtn").onclick = function() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  auth.signInWithEmailAndPassword(email, senha)
    .then(res => {
      exibirFeedback("Logado como " + res.user.email);
      document.getElementById("loginBtn").disabled = true;
      document.getElementById("logoutBtn").style.display = "";
      document.getElementById("loginBtn").style.display = "none";
      document.getElementById("loginForm").querySelectorAll("input").forEach(i => i.disabled = true);
    })
    .catch(err => exibirFeedback("Erro no login: " + err.message));
};

document.getElementById("logoutBtn").onclick = function() {
  auth.signOut().then(() => {
    limparTelaAoDeslogar();
  });
};

// ===== VERIFICAR PAPEL DO USUÁRIO =====
async function verificarAdminNoDatabase(uid) {
  if (!uid) return false;
  try {
    const snapshot = await db.ref('admins/' + uid).once('value');
    return !!snapshot.val();
  } catch (error) {
    console.error("Erro ao verificar admin no DB:", error);
    return false;
  }
}
async function verificarCoordNoDatabase(uid) {
  if (!uid) return false;
  try {
    const snapshot = await db.ref('coords/' + uid).once('value');
    return !!snapshot.val();
  } catch (error) {
    console.error("Erro ao verificar coord no DB:", error);
    return false;
  }
}
// Função para carregar motivos do Firebase ao iniciar a aplicação
function carregarMotivosDoFirebase() {
  db.ref("motivos/desistentes").once("value").then(snapshot => {
    motivosDesistentes = snapshot.val() || [];
  });
  db.ref("motivos/eliminados").once("value").then(snapshot => {
    motivosEliminados = snapshot.val() || [];
  });
}

auth.onAuthStateChanged(async (user) => {
  usuarioAtual = user;
  if (user) {
    ehAdmin = await verificarAdminNoDatabase(user.uid);
    ehCoord = await verificarCoordNoDatabase(user.uid);
    atualizarStatusLogin();
    carregarEventosDoFirebase();
    carregarMotivosDoFirebase(); // <-- Adicione esta linha!

    document.getElementById("loginBtn").disabled = true;
    document.getElementById("logoutBtn").style.display = "";
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("loginForm").querySelectorAll("input").forEach(i => i.disabled = true);

    document.getElementById("filtroEvento").style.display = "";
    document.getElementById("labelEvento").style.display = "";
    document.getElementById("filtroTurno").style.display = "none";
    document.getElementById("labelTurno").style.display = "none";
    document.getElementById("filtroEscola").style.display = "none";
    document.getElementById("labelEscola").style.display = "none";
  } else {
    limparTelaAoDeslogar();
  }
});

function atualizarStatusLogin() {
  const el = document.getElementById("loginStatus");
  if (usuarioAtual) {
    let roleText = "";
    if (ehAdmin) {
      roleText = " <span style='color: red;'>(Admin)</span>";
    } else if (ehCoord) {
      roleText = " <span style='color: blue;'>(Coordenador)</span>";
    }
    el.innerHTML = `<b>Usuário:</b> ${usuarioAtual.email || usuarioAtual.uid}${roleText}`;
    document.getElementById("exportBtn").style.display = ehAdmin ? "" : "none";
    document.getElementById("limparBtn").style.display = ehAdmin ? "" : "none";
    document.getElementById("importCsvBtnBox").style.display = ehAdmin ? "" : "none";
    document.getElementById("salvarTodasBtn").style.display = ehAdmin ? "" : "none";
    document.getElementById("salvarBtn").disabled = !(ehAdmin || ehCoord);
  } else {
    el.innerHTML = `<b>Não logado</b>`;
    document.getElementById("salvarBtn").disabled = true;
    document.getElementById("exportBtn").style.display = "none";
    document.getElementById("limparBtn").style.display = "none";
    document.getElementById("importCsvBtnBox").style.display = "none";
    document.getElementById("salvarTodasBtn").style.display = "none";
  }
}

// ===== FILTROS =====
function atualizarFiltroEvento() {
  const select = document.getElementById("filtroEvento");
  select.innerHTML = "";
  const optionTodas = document.createElement("option");
  optionTodas.value = "";
  optionTodas.textContent = "Todos";
  select.appendChild(optionTodas);
  eventos.forEach(evt => {
    const opt = document.createElement("option");
    opt.value = evt;
    opt.textContent = evt;
    select.appendChild(opt);
  });
}
function atualizarFiltroTurno() {
  const select = document.getElementById("filtroTurno");
  select.innerHTML = "";
  const optionTodas = document.createElement("option");
  optionTodas.value = "";
  optionTodas.textContent = "Todos";
  select.appendChild(optionTodas);
  turnos.forEach(turno => {
    const opt = document.createElement("option");
    opt.value = turno;
    opt.textContent = turno;
    select.appendChild(opt);
  });
}
function atualizarFiltroEscola() {
  const select = document.getElementById("filtroEscola");
  select.innerHTML = "";
  const optionTodas = document.createElement("option");
  optionTodas.value = "";
  optionTodas.textContent = "Todas";
  select.appendChild(optionTodas);
  escolas.forEach(escola => {
    const opt = document.createElement("option");
    opt.value = escola;
    opt.textContent = escola;
    select.appendChild(opt);
  });
}
document.getElementById("filtroEvento").addEventListener("change", function() {
  const eventoSelecionado = this.value;
  const exibir = eventoSelecionado !== "";
  document.getElementById("filtroTurno").style.display = exibir ? "" : "none";
  document.getElementById("labelTurno").style.display = exibir ? "" : "none";
  document.getElementById("filtroEscola").style.display = exibir ? "" : "none";
  document.getElementById("labelEscola").style.display = exibir ? "" : "none";
  document.getElementById("eventos").style.display = exibir ? "" : "none";
  document.getElementById("totais").style.display = exibir ? "" : "none";
  document.getElementById("actionButtons").style.display = exibir ? "" : "none";

  if (exibir) {
    carregarEventoFiltradoDoFirebase();
  } else {
    document.getElementById("eventos").innerHTML = "";
    document.getElementById("totais").innerHTML = "";
  }
});
document.getElementById("filtroEvento").addEventListener("change", () => carregarVisualSalas(dados));
document.getElementById("filtroTurno").addEventListener("change", () => carregarVisualSalas(dados));
document.getElementById("filtroEscola").addEventListener("change", () => carregarVisualSalas(dados));

// ===== IMPORTAÇÃO DE MOTIVOS =====
// Função para carregar motivos do Firebase ao iniciar a aplicação
function carregarMotivosDoFirebase() {
  db.ref("motivos/desistentes").once("value").then(snapshot => {
    motivosDesistentes = snapshot.val() || [];
  });
  db.ref("motivos/eliminados").once("value").then(snapshot => {
    motivosEliminados = snapshot.val() || [];
  });
}

// Chame sempre após login bem-sucedido:
auth.onAuthStateChanged(async (user) => {
  usuarioAtual = user;
  if (user) {
    ehAdmin = await verificarAdminNoDatabase(user.uid);
    ehCoord = await verificarCoordNoDatabase(user.uid);
    atualizarStatusLogin();
    carregarEventosDoFirebase();
    carregarMotivosDoFirebase(); // <-- adiciona aqui
    // ...
  } else {
    limparTelaAoDeslogar();
  }
});
function limparUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(limparUndefined);
  } else if (typeof obj === 'object' && obj !== null) {
    const novo = {};
    for (const k in obj) {
      if (obj[k] === undefined) {
        novo[k] = null; // ou "" se preferir string vazia
      } else {
        novo[k] = limparUndefined(obj[k]);
      }
    }
    return novo;
  } else {
    return obj;
  }
}
// Importação dos motivos via CSV (só aparece para admin)
document.getElementById("motivosCsvFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      motivosDesistentes = [];
      motivosEliminados = [];
      results.data.forEach(row => {
        const motivo = (row.Motivo || "").toLowerCase();
        const item = row.Item || "";
        const alinea = row["Alínea"] || row.Alinea || "";
        const descricao = `Item ${item} - Alínea ${alinea}`;
        if (motivo === "desistente") {
          motivosDesistentes.push({ motivo, item, alinea, descricao });
        } else if (motivo === "eliminado") {
          motivosEliminados.push({ motivo, item, alinea, descricao });
        }
      });
      // Se for admin, salva na nuvem!
      if (ehAdmin) {
        db.ref("motivos/desistentes").set(motivosDesistentes);
        db.ref("motivos/eliminados").set(motivosEliminados);
        exibirFeedback("Motivos importados e salvos na nuvem!");
      } else {
        exibirFeedback("Motivos importados localmente (apenas admin pode salvar na nuvem).");
      }
    },
    error: function (err) {
      exibirFeedback("Erro ao importar motivos: " + err.message);
    }
  });
});

// Popup dinâmico para seleção de motivo
function abrirPopupMotivo(tipo, idx, detalhesArr, onUpdate) {
  const motivos = tipo === "desistente" ? motivosDesistentes : motivosEliminados;
  if (!motivos.length) {
    exibirFeedback("Nenhum motivo importado para " + tipo + ".");
    return;
  }
  const options = motivos.map((m, i) => 
    `<option value="${i}">${m.descricao}</option>`
  ).join("");
  const modal = document.createElement('div');
  modal.id = "popupMotivo";
  modal.style = `
    position:fixed;top:0;left:0;width:100vw;height:100vh;
    background:rgba(30,30,30,0.36);display:flex;align-items:center;justify-content:center;z-index:9999
  `;
  modal.innerHTML = `
    <div style="background:#fff;padding:2rem;border-radius:8px;min-width:220px;">
      <h3>Selecione o motivo</h3>
      <select id="motivoSelect">${options}</select>
      <br><br>
      <button id="confirmMotivoBtn">Confirmar</button>
      <button id="cancelMotivoBtn">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  // Seleciona o motivo já existente, se houver
  if (typeof detalhesArr[idx]?.motivo !== 'undefined') {
    const indexSelecionado = motivos.findIndex(m => m.descricao === detalhesArr[idx].motivo);
    if (indexSelecionado >= 0) document.getElementById("motivoSelect").value = indexSelecionado;
  }

  document.getElementById("confirmMotivoBtn").onclick = function() {
    const select = document.getElementById("motivoSelect");
    const motivoIndex = parseInt(select.value);
    const motivo = motivos[motivoIndex];
    detalhesArr[idx] = {
      inscricao: detalhesArr[idx]?.inscricao || "",
      descricao: motivo.descricao, // <-- aqui!
      motivo: motivo.descricao,
      valor: motivo.valor || "",
      item: motivo.item || "",
      alinea: motivo.alinea || ""
    };
    onUpdate();
    modal.remove();
  };
}

// ===== CARREGAMENTO E SINCRONIZAÇÃO DOS DADOS =====
function montarFiltrosEDados(salasArray) {
  dados = [];
  eventos = [];
  turnos = [];
  escolas = [];
  salasArray.forEach(sala => {
    if (!eventos.includes(sala.evento)) eventos.push(sala.evento);
    if (!turnos.includes(sala.turno)) turnos.push(sala.turno);
    if (!escolas.includes(sala.escola)) escolas.push(sala.escola);
    dados.push({
      evento: sala.evento || "",
      turno: sala.turno || "",
      escola: sala.escola || "",
      sala: sala.sala || "",
      total: sala.total || 0,
      ausentes: sala.ausentes || 0,
      presentes: sala.presentes || sala.total || 0,
      desistentes: sala.desistentes || 0,
      eliminados: sala.eliminados || 0,
      desistentesDetalhes: sala.desistentesDetalhes || [],
      eliminadosDetalhes: sala.eliminadosDetalhes || [],
    });
  });
  atualizarFiltroEvento();
  atualizarFiltroTurno();
  atualizarFiltroEscola();
}

function carregarEventosDoFirebase() {
  db.ref('relatorio_por_evento').once('value').then(snapshot => {
    const val = snapshot.val();
    let todasSalas = [];
    let nomesEventos = [];
    if (val && typeof val === 'object') {
      nomesEventos = Object.keys(val);
      Object.entries(val).forEach(([evento, eventoData]) => {
        if (eventoData.turnos) {
          Object.entries(eventoData.turnos).forEach(([turno, turnoData]) => {
            if (turnoData.escolas) {
              Object.entries(turnoData.escolas).forEach(([escola, escolaData]) => {
                if (escolaData.salas) {
                  Object.entries(escolaData.salas).forEach(([sala, salaData]) => {
                    todasSalas.push({
                      ...salaData,
                      evento: salaData.evento || evento,
                      turno: salaData.turno || turno,
                      escola: salaData.escola || escola,
                      sala: salaData.sala || sala
                    });
                  });
                }
              });
            }
          });
        }
      });
    }
    eventos = nomesEventos;
    montarFiltrosEDados(todasSalas);
    // NÃO chama carregarVisualSalas(dados) aqui!
    exibirFeedback("Eventos carregados da nuvem!");
  });
}

function carregarEventoFiltradoDoFirebase() {
  const eventoFiltro = document.getElementById("filtroEvento").value;
  if (!eventoFiltro) {
    document.getElementById("eventos").innerHTML = "";
    document.getElementById("totais").innerHTML = "";
    return;
  }
  const eventoKey = normalizarEvento(eventoFiltro);

  db.ref(`relatorio_por_evento/${eventoKey}/turnos`).once('value').then(snapshot => {
    const val = snapshot.val();
    let salas = [];
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([turno, turnoData]) => {
        if (turnoData.escolas) {
          Object.entries(turnoData.escolas).forEach(([escola, escolaData]) => {
            if (escolaData.salas) {
              Object.entries(escolaData.salas).forEach(([sala, salaData]) => {
                salas.push({
                  ...salaData,
                  evento: eventoFiltro,
                  turno: turno,
                  escola: escola,
                  sala: sala
                });
              });
            }
          });
        }
      });
    }

    montarFiltrosEDados(salas);
    // 🔹 Reaplica o valor escolhido
    document.getElementById("filtroEvento").value = eventoFiltro;

    carregarVisualSalas(dados);
    exibirFeedback("Evento carregado!");
  });
}


// ===== SÓ CARDS DAS SALAS =====
function carregarVisualSalas(dadosArray) {
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  const container = document.getElementById("eventos");
  container.innerHTML = "";
  container.style.display = "";

  let dadosFiltrados = dadosArray.filter(sala =>
    (eventoFiltro === "" || sala.evento === eventoFiltro) &&
    (turnoFiltro === "" || sala.turno === turnoFiltro) &&
    (escolaFiltro === "" || sala.escola === escolaFiltro)
  );

  // ORDENAÇÃO: Escola > Turno > Sala (número)
  dadosFiltrados.sort((a, b) => {
    // 1. Escola
    if (a.escola !== b.escola) return a.escola.localeCompare(b.escola, 'pt-BR', { sensitivity: 'base' });
    // 2. Turno
    if (a.turno !== b.turno) return a.turno.localeCompare(b.turno, 'pt-BR', { sensitivity: 'base' });
    // 3. Sala (número)
    const numA = parseInt(a.sala.match(/\d+/)?.[0], 10) || 0;
    const numB = parseInt(b.sala.match(/\d+/)?.[0], 10) || 0;
    if (numA !== numB) return numA - numB;
    // 4. Se nomes iguais, ordem alfabética
    return a.sala.localeCompare(b.sala, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  if (dadosFiltrados.length === 0) {
    container.innerHTML = "<p>Nenhuma sala encontrada para os filtros selecionados.</p>";
    calcularETotalizar();
    return;
  }
  dadosFiltrados.forEach((sala, idx) => {
    container.appendChild(criarCardSala(sala, idx));
  });
  calcularETotalizar();
  desenharResumoEvento();
}

// CARD BONITO DE SALA
function criarCardSala(sala, idx) {
  sala.desistentesDetalhes = sala.desistentesDetalhes || [];
  sala.eliminadosDetalhes = sala.eliminadosDetalhes || [];

  const card = document.createElement("div");
  card.className = "sala-card";

  // Evento na primeira linha
  const eventoDiv = document.createElement("div");
  eventoDiv.className = "sala-evento";
  eventoDiv.innerHTML = `<b>Evento:</b> <span>${sala.evento}</span>`;
  card.appendChild(eventoDiv);

  // Escola, Turno, Total na segunda linha
  const infoDiv = document.createElement("div");
  infoDiv.className = "sala-info";
  infoDiv.innerHTML = `
    <b>Escola:</b> <span>${sala.escola}</span> &nbsp; | &nbsp;
    <b>Turno:</b> <span>${sala.turno}</span> &nbsp; | &nbsp;
    <b>Total:</b> <span>${sala.total}</span>
  `;
  card.appendChild(infoDiv);

  // Sala na terceira linha, destacada
  const salaDiv = document.createElement("div");
  salaDiv.className = "sala-nome";
  salaDiv.innerHTML = `<b>Sala:</b> <span>${sala.sala}</span>`;
  card.appendChild(salaDiv);

  // Campos em grid alinhado
  const camposGrid = document.createElement("div");
  camposGrid.className = "sala-campos-grid";
  camposGrid.innerHTML = `
    <div class="sala-campo"><label for="ausentes${idx}">Ausentes:</label> <input type="number" id="ausentes${idx}" min="0" value="${sala.ausentes || 0}" aria-label="Ausentes"></div>
    <div class="sala-campo"><label for="presentes${idx}">Presentes:</label> <input type="number" id="presentes${idx}" readonly value="${sala.presentes || sala.total || 0}" aria-label="Presentes"></div>
    <div class="sala-campo"><label for="desistentes${idx}">Desistentes:</label> <input type="number" id="desistentes${idx}" min="0" value="${sala.desistentes || 0}" aria-label="Desistentes"></div>
    <div class="sala-campo"><label for="eliminados${idx}">Eliminados:</label> <input type="number" id="eliminados${idx}" min="0" value="${sala.eliminados || 0}" aria-label="Eliminados"></div>
  `;
  card.appendChild(camposGrid);

  // Atualiza presentes quando ausentes muda
  const ausentesInput = camposGrid.querySelector(`#ausentes${idx}`);
  const presentesInput = camposGrid.querySelector(`#presentes${idx}`);

  ausentesInput.oninput = (e) => {
    sala.ausentes = parseInt(e.target.value) || 0;
    sala.presentes = (parseInt(sala.total) || 0) - sala.ausentes;
    presentesInput.value = sala.presentes >= 0 ? sala.presentes : 0;
  };

  // Div de detalhes dinâmicos (vai ser atualizada)
  const detalhesDiv = document.createElement("div");
  detalhesDiv.className = "sala-detalhes";
  card.appendChild(detalhesDiv);

  // Função para desenhar campos de inscrição + motivo
function desenharDetalhes() {
  detalhesDiv.innerHTML = "";
  // Desistentes
  for (let i = 0; i < (sala.desistentes || 0); i++) {
    sala.desistentesDetalhes[i] = sala.desistentesDetalhes[i] || {};
    const inscInput = document.createElement("input");
    inscInput.type = "text";
    inscInput.placeholder = `Inscrição Desistente ${i+1}`;
    inscInput.value = sala.desistentesDetalhes[i]?.inscricao || "";
    inscInput.oninput = () => {
      sala.desistentesDetalhes[i].inscricao = inscInput.value;
    };

    const motivoBtn = document.createElement("button");
    motivoBtn.textContent = sala.desistentesDetalhes[i]?.descricao || "Selecionar motivo";

    // NOVO: campo ao lado mostrando motivo escolhido
    const motivoSpan = document.createElement("span");
    motivoSpan.style = "margin-left:8px; color:#1a237e; font-weight:bold;";
    motivoSpan.textContent = sala.desistentesDetalhes[i]?.descricao || "";

    motivoBtn.onclick = () => abrirPopupMotivo("desistente", i, sala.desistentesDetalhes, () => {
      motivoBtn.textContent = sala.desistentesDetalhes[i]?.descricao || "Selecionar motivo";
      motivoSpan.textContent = sala.desistentesDetalhes[i]?.descricao || "";
    });

    detalhesDiv.appendChild(inscInput);
    detalhesDiv.appendChild(motivoBtn);
    detalhesDiv.appendChild(motivoSpan);
  }
  // Eliminados
  for (let i = 0; i < (sala.eliminados || 0); i++) {
    sala.eliminadosDetalhes[i] = sala.eliminadosDetalhes[i] || { inscricao: "", descricao: "" };
    const inscInput = document.createElement("input");
    inscInput.type = "text";
    inscInput.placeholder = `Inscrição Eliminado ${i+1}`;
    inscInput.value = sala.eliminadosDetalhes[i]?.inscricao || "";
    inscInput.oninput = () => {
      sala.eliminadosDetalhes[i].inscricao = inscInput.value;
    };

    const motivoBtn = document.createElement("button");
    motivoBtn.textContent = sala.eliminadosDetalhes[i]?.descricao || "Selecionar motivo";

    // NOVO: campo ao lado mostrando motivo escolhido
    const motivoSpan = document.createElement("span");
    motivoSpan.style = "margin-left:8px; color:#b71c1c; font-weight:bold;";
    motivoSpan.textContent = sala.eliminadosDetalhes[i]?.descricao || "";

    motivoBtn.onclick = () => abrirPopupMotivo("eliminado", i, sala.eliminadosDetalhes, () => {
      motivoBtn.textContent = sala.eliminadosDetalhes[i]?.descricao || "Selecionar motivo";
      motivoSpan.textContent = sala.eliminadosDetalhes[i]?.descricao || "";
    });

    detalhesDiv.appendChild(inscInput);
    detalhesDiv.appendChild(motivoBtn);
    detalhesDiv.appendChild(motivoSpan);
  }
}

  // Atualiza campos dinâmicos ao mudar número de desistentes/eliminados
  camposGrid.querySelector(`#desistentes${idx}`).oninput = (e) => {
    sala.desistentes = parseInt(e.target.value) || 0;
    desenharDetalhes();
  };
  camposGrid.querySelector(`#eliminados${idx}`).oninput = (e) => {
    sala.eliminados = parseInt(e.target.value) || 0;
    desenharDetalhes();
  };

  desenharDetalhes();

  return card;
}

// ===== SINCRONIZAÇÃO DOS INPUTS DOS CARDS =====
// ===== SINCRONIZAÇÃO DOS INPUTS DOS CARDS =====
function sincronizarDadosComInputs() {
  const cards = document.querySelectorAll(".sala-card");
  cards.forEach(card => {
    // Captura os dados diretamente dos elementos dos cards
    const evento = card.querySelector(".sala-evento span")?.innerText.trim() || "";
    // A ordem dos spans em .sala-info é:
    // <span>Escola</span> &nbsp; | &nbsp; <span>Turno</span> &nbsp; | &nbsp; <span>Total</span>
    const escola = card.querySelector(".sala-info span:nth-child(1)")?.innerText.trim() || "";
    const turno = card.querySelector(".sala-info span:nth-child(2)")?.innerText.trim() || "";
    const total = parseInt(card.querySelector(".sala-info span:nth-child(3)")?.innerText.trim()) || 0;
    const sala = card.querySelector(".sala-nome span")?.innerText.trim() || "";

    const salaObj = dados.find(s =>
      s.evento == evento && s.escola == escola && s.turno == turno && s.sala == sala
    );
    if (!salaObj) return;

    salaObj.total = total;
    salaObj.ausentes = parseInt(card.querySelector("input[aria-label='Ausentes']")?.value) || 0;
    salaObj.presentes = parseInt(card.querySelector("input[aria-label='Presentes']")?.value) || 0;
    salaObj.desistentes = parseInt(card.querySelector("input[aria-label='Desistentes']")?.value) || 0;
    salaObj.eliminados = parseInt(card.querySelector("input[aria-label='Eliminados']")?.value) || 0;

    salaObj.desistentesDetalhes = [];
    salaObj.eliminadosDetalhes = [];
    const detalhesDiv = card.querySelector(".sala-detalhes");
    if (detalhesDiv) {
      detalhesDiv.querySelectorAll("input[placeholder^='Inscrição Desistente']").forEach((inscInput, i) => {
        const motivoBtn = inscInput.nextSibling;
        salaObj.desistentesDetalhes.push({
          inscricao: inscInput.value,
          descricao: motivoBtn.textContent
        });
      });
      detalhesDiv.querySelectorAll("input[placeholder^='Inscrição Eliminado']").forEach((inscInput, i) => {
        const motivoBtn = inscInput.nextSibling;
        salaObj.eliminadosDetalhes.push({
          inscricao: inscInput.value,
          descricao: motivoBtn.textContent
        });
      });
    }
  });
}

// ===== FEEDBACK, HISTÓRICO, ETC =====
function exibirFeedback(msg, tempo = 3000) {
  const fb = document.getElementById("feedback");
  fb.textContent = msg;
  setTimeout(() => fb.textContent = "", tempo);
}

function mostrarHistorico() {
  db.ref("historico").orderByChild("horario").limitToLast(10).on("value", snapshot => {
    const historico = snapshot.val() || {};
    let html = "<h3>Histórico de ações recentes</h3><ul>";
    Object.values(historico).reverse().forEach(log => {
      html += `<li><b>${log.tipo.toUpperCase()}</b> por ${log.usuario} ${log.admin ? "(Admin)" : ""} em ${new Date(log.horario).toLocaleString("pt-BR")}</li>`;
    });
    html += "</ul>";
    document.getElementById("historico").innerHTML = html;
  });
}
mostrarHistorico();

function limparTelaAoDeslogar() {
  dados = [];
  eventos = [];
  turnos = [];
  escolas = [];
  usuarioAtual = null;
  ehAdmin = false;
  ehCoord = false;

  document.getElementById("eventos").innerHTML = "";
  document.getElementById("eventos").style.display = "none";
  document.getElementById("totais").innerHTML = "";
  document.getElementById("totais").style.display = "none";
  document.getElementById("historico").innerHTML = "";
  document.getElementById("feedback").textContent = "";

  document.getElementById("actionButtons").style.display = "none";
  document.getElementById("importCsvBtnBox").style.display = "none";

  document.getElementById("filtroEvento").value = "";
  document.getElementById("filtroEvento").innerHTML = "";
  document.getElementById("filtroEvento").style.display = "none";
  document.getElementById("labelEvento").style.display = "none";

  document.getElementById("filtroTurno").value = "";
  document.getElementById("filtroTurno").innerHTML = "";
  document.getElementById("filtroTurno").style.display = "none";
  document.getElementById("labelTurno").style.display = "none";

  document.getElementById("filtroEscola").value = "";
  document.getElementById("filtroEscola").innerHTML = "";
  document.getElementById("filtroEscola").style.display = "none";
  document.getElementById("labelEscola").style.display = "none";

  document.getElementById("loginForm").style.display = "";
  document.getElementById("loginBtn").disabled = false;
  document.getElementById("loginBtn").style.display = "";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("loginForm").querySelectorAll("input").forEach(i => i.disabled = false);
}

// ===== CSV IMPORTAÇÃO E TOTALIZAÇÃO
document.getElementById("csvFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  // Função para limpar "Sala", "Sala:", "sala", etc
  function limparNomeSala(nome) {
    return (nome || "").replace(/sala:?/gi, "").trim();
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (!results.data || results.data.length === 0) {
        exibirFeedback("Arquivo CSV vazio ou inválido.");
        return;
      }

      results.data.forEach(row => {
        const eventoKey = normalizar(row.Evento || row.evento || "");
        const turnoKey = normalizar(row.Turno || row.turno || "");
        const escolaKey = row.Escola || row.escola || "";
        // LIMPA O NOME DA SALA
        const salaKey = limparNomeSala(row.Sala || row.sala || "");

        const dadosSala = {
          evento: row.Evento || row.evento || "",
          turno: row.Turno || row.turno || "",
          escola: row.Escola || row.escola || "",
          sala: limparNomeSala(row.Sala || row.sala || ""), // LIMPA TAMBÉM AQUI!
          total: parseInt(row.Quantidade || row.Total || row.total) || 0,
          ausentes: 0,
          presentes: parseInt(row.Quantidade || row.Total || row.total) || 0,
          desistentes: 0,
          eliminados: 0,
          desistentesDetalhes: [],
          eliminadosDetalhes: []
        };

        firebase.database().ref(
          `relatorio_por_evento/${eventoKey}/turnos/${turnoKey}/escolas/${escolaKey}/salas/${salaKey}`
        ).set(dadosSala);
      });

      exibirFeedback("CSV importado na estrutura correta!");
    },
    error: function (err) {
      exibirFeedback("Erro ao importar CSV: " + err.message);
    }
  });
});

function calcularETotalizar() {
  let total = 0, aus = 0, pres = 0, des = 0, elim = 0;
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  dados.forEach(sala => {
    if ((eventoFiltro && sala.evento !== eventoFiltro) ||
        (turnoFiltro && sala.turno !== turnoFiltro) ||
        (escolaFiltro && sala.escola !== escolaFiltro)) return;
    total += parseInt(sala.total) || 0;
    aus += parseInt(sala.ausentes) || 0;
    pres += parseInt(sala.presentes) || 0;
    des += parseInt(sala.desistentes) || 0;
    elim += parseInt(sala.eliminados) || 0;
  });
  const abst = total ? ((aus / total) * 100).toFixed(2) : "0.00";
  document.getElementById("totais").innerHTML = `
    <h2>Totais do Evento</h2>
    <b>Total Candidatos:</b> ${total}<br>
    <b>Ausentes:</b> ${aus}<br>
    <b>Presentes:</b> ${pres}<br>
    <b>Desistentes:</b> ${des}<br>
    <b>Eliminados:</b> ${elim}<br>
    <b>% Abstenção:</b> ${abst}%
  `;
  document.getElementById("totais").style.display = "";
}

// ===== NORMALIZADOR
function normalizarEvento(nome) {
  return nome
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "");
}
function normalizar(str) {
  return str.trim().toLowerCase().replace(/\s+/g, "_").normalize('NFD').replace(/[\u0300-\u036f]/g, "");
}

// ===== BOTÕES: adapte os seus para chamar sincronizarDadosComInputs antes de salvar/exportar =====
document.getElementById("salvarBtn").onclick = function() {
  sincronizarDadosComInputs();
  salvarEscolaFiltradaNoFirebase();
};
document.getElementById("exportBtn").onclick = function() {
  sincronizarDadosComInputs();

  // pega o label selecionado e a chave normalizada para enviar ao backend
  const eventoLabel = document.getElementById("filtroEvento").value || "";
  const eventoKey = eventoLabel ? normalizarEvento(eventoLabel) : "";
  const turno = document.getElementById("filtroTurno").value || "";
  const escola = document.getElementById("filtroEscola").value || "";
  const formato = "xlsx";

  // DEBUG: log antes de redirecionar (abra o Console do navegador para ver)
  console.log("Exportando — eventoLabel:", eventoLabel, "eventoKey:", eventoKey, "turno:", turno, "escola:", escola);

  // envia a chave normalizada (eventoKey) para o backend
  const url = `https://controle-abstencao.onrender.com/exportar_relatorio?evento=${encodeURIComponent(eventoKey)}&turno=${encodeURIComponent(turno)}&escola=${encodeURIComponent(escola)}&formato=${formato}`;
  window.location.href = url;
};
document.getElementById("limparBtn").onclick = limparFirebase;
document.getElementById("salvarTodasBtn").onclick = function() {
  sincronizarDadosComInputs();
  salvarTodasEscolasNoFirebase();
};

// ===== SALVAR DADOS DA ESCOLA DO FILTRO =====
function salvarEscolaFiltradaNoFirebase() {
  if (!usuarioAtual || !(ehAdmin || ehCoord)) {
    exibirFeedback("Faça login como admin ou coordenador para salvar.");
    return;
  }
  sincronizarDadosComInputs();
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  const dadosFiltrados = dados.filter(sala =>
    (eventoFiltro === "" || sala.evento === eventoFiltro) &&
    (turnoFiltro === "" || sala.turno === turnoFiltro) &&
    (escolaFiltro === "" || sala.escola === escolaFiltro)
  );
  if (dadosFiltrados.length === 0) {
    exibirFeedback("Nenhum dado para salvar com esses filtros.");
    return;
  }

  // Salva cada sala individualmente no caminho correto
  let promessas = [];
  dadosFiltrados.forEach(sala => {
    const eventoKey = normalizarEvento(sala.evento);
    const turnoKey = normalizarEvento(sala.turno);
    const escolaKey = sala.escola;
    const salaKey = sala.sala;
    promessas.push(
      db.ref(`relatorio_por_evento/${eventoKey}/turnos/${turnoKey}/escolas/${escolaKey}/salas/${salaKey}`)
        .set(limparUndefined(sala))
    );
  });

  Promise.all(promessas)
    .then(() => {
    exibirFeedback("Alterações salvas no relatório do evento!");
    registrarAcao("salvar");
    carregarEventoFiltradoDoFirebase();
  })
    .catch(() => {
      exibirFeedback("Erro ao salvar alterações!");
    });
}
// ===== SALVAR TODOS OS DADOS DAS ESCOLAS (APENAS ADMIN) =====
function salvarTodasEscolasNoFirebase() {
  if (!ehAdmin) {
    exibirFeedback("Somente admin pode salvar todas as escolas.");
    return;
  }
  sincronizarDadosComInputs();

  let promessas = [];
  dados.forEach(sala => {
    const eventoKey = normalizarEvento(sala.evento);
    const turnoKey = normalizarEvento(sala.turno);
    const escolaKey = sala.escola;
    const salaKey = sala.sala;
    promessas.push(
      db.ref(`relatorio_por_evento/${eventoKey}/turnos/${turnoKey}/escolas/${escolaKey}/salas/${salaKey}`)
        .set(sala)
    );
  });

  Promise.all(promessas)
    .then(() => {
      exibirFeedback("Dados de todas as escolas salvos com sucesso!");
      registrarAcao("salvar_todas");

      // Limpa filtros e tela
      document.getElementById("filtroEvento").value = "";
      document.getElementById("filtroTurno").value = "";
      document.getElementById("filtroEscola").value = "";
      document.getElementById("eventos").innerHTML = "";
      document.getElementById("totais").innerHTML = "";

      // Limpa array em memória
      dados = [];

      // NÃO CHAME montarFiltrosEDados, atualizarFiltroEvento, nem carregarEventosDoFirebase aqui!
      // Apenas aguarde o usuário escolher o evento no filtro!
    })
    .catch(() => {
      exibirFeedback("Erro ao salvar todas as escolas!");
    });
}
// ===== LIMPAR TODOS OS DADOS DAS ESCOLAS (APENAS ADMIN) =====
function limparFirebase() {
  if (!ehAdmin) {
    exibirFeedback("Apenas o administrador pode limpar todos os dados.");
    return;
  }
  db.ref('relatorio_por_evento').once('value', snapshot => {
    if (!snapshot.exists()) {
      exibirFeedback("Não há dados para limpar!");
      return;
    }
    db.ref('relatorio_por_evento').remove()
      .then(() => {
        limparCampos();
        document.getElementById("eventos").innerHTML = "";
        document.getElementById("totais").innerHTML = "";
        exibirFeedback("Dados do evento limpos! (Admin)");
        registrarAcao("limpar");
        // Se quiser recarregar a tela, chame carregarEventosDoFirebase();
      })
      .catch(err => {
        exibirFeedback("Erro ao limpar dados: " + err.message);
        console.error("Erro ao tentar limpar Firebase:", err);
      });
  });
}
// ===== HISTÓRICO DE AÇÕES =====
function registrarAcao(tipo) {
  if (!usuarioAtual) return;
  const log = {
    tipo,
    usuario: usuarioAtual.email || usuarioAtual.uid,
    admin: ehAdmin,
    horario: new Date().toISOString()
  };
  const novaChave = db.ref("historico").push().key;
  db.ref("historico/" + novaChave).set(log);
}
function mostrarHistorico() {
  db.ref("historico").orderByChild("horario").limitToLast(10).on("value", snapshot => {
    const historico = snapshot.val() || {};
    let html = "<h3>Histórico de ações recentes</h3><ul>";
    Object.values(historico).reverse().forEach(log => {
      html += `<li><b>${log.tipo.toUpperCase()}</b> por ${log.usuario} ${log.admin ? "(Admin)" : ""} em ${new Date(log.horario).toLocaleString("pt-BR")}</li>`;
    });
    html += "</ul>";
    document.getElementById("historico").innerHTML = html;
  });
}

// ===== INTERFACE E DADOS =====
function exibirFeedback(msg, tempo = 3000) {
  const fb = document.getElementById("feedback");
  fb.textContent = msg;
  setTimeout(() => fb.textContent = "", tempo);
}
function ordenarSalasTurno(salas) {
  return salas.sort((a, b) => {
    if (a.turno !== b.turno) return a.turno.localeCompare(b.turno, 'pt-BR', { sensitivity: 'base' });
    const numA = parseInt(a.sala.match(/\d+/)?.[0], 10) || 0;
    const numB = parseInt(b.sala.match(/\d+/)?.[0], 10) || 0;
    if (numA !== numB) return numA - numB;
    return a.sala.localeCompare(b.sala, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });
}

function exportarXLSX() {
  if (!ehAdmin) return;
  sincronizarDadosComInputs();
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  const exportarSalas = dados.filter(sala =>
    (eventoFiltro === "" || sala.evento === eventoFiltro) &&
    (turnoFiltro === "" || sala.turno === turnoFiltro) &&
    (escolaFiltro === "" || sala.escola === escolaFiltro)
  );

  const sheetData = [
    ["Evento", "Turno", "Escola", "Sala", "Total", "Ausentes", "Presentes",
      "Desistentes", "Inscrição_Desistente", "Motivo_Desistente",
      "Eliminados", "Inscrição_Eliminado", "Motivo_Eliminado", "% Abstenção"]
  ];

  // Agrupa as salas por escola
  const escolas = {};
  let totalGeral = {
    total: 0, ausentes: 0, presentes: 0, desistentes: 0, eliminados: 0
  };
  exportarSalas.forEach(sala => {
    if (!escolas[sala.escola]) escolas[sala.escola] = [];
    escolas[sala.escola].push(sala);

    totalGeral.total += Number(sala.total || 0);
    totalGeral.ausentes += Number(sala.ausentes || 0);
    totalGeral.presentes += Number(sala.presentes || 0);
    totalGeral.desistentes += Number(sala.desistentes || 0);
    totalGeral.eliminados += Number(sala.eliminados || 0);
  });

  // Para cada escola, adiciona as salas ordenadas e em seguida o total da escola
  Object.keys(escolas).forEach(escolaNome => {
    let escTotal = 0, escAusentes = 0, escPresentes = 0, escDesistentes = 0, escEliminados = 0;
    const salasOrdenadas = ordenarSalasTurno(escolas[escolaNome]);
    salasOrdenadas.forEach(sala => {
      const maxCount = Math.max(
        sala.desistentesDetalhes?.length || 0,
        sala.eliminadosDetalhes?.length || 0,
        1
      );
      for (let i = 0; i < maxCount; i++) {
        const desist = sala.desistentesDetalhes?.[i] || {};
        const elim = sala.eliminadosDetalhes?.[i] || {};
        const abstSala = sala.total ? ((sala.ausentes / sala.total) * 100).toFixed(2).replace('.', ',') + "%" : "0,00%";
        sheetData.push([
          sala.evento,
          sala.turno,
          sala.escola,
          sala.sala,
          sala.total,
          sala.ausentes,
          sala.presentes,
          sala.desistentes > i ? 1 : "",
          desist.inscricao || "",
          desist.motivo || "",
          sala.eliminados > i ? 1 : "",
          elim.inscricao || "",
          elim.motivo || "",
          abstSala
        ]);
      }
      escTotal += Number(sala.total || 0);
      escAusentes += Number(sala.ausentes || 0);
      escPresentes += Number(sala.presentes || 0);
      escDesistentes += Number(sala.desistentes || 0);
      escEliminados += Number(sala.eliminados || 0);
    });

    const percAbst = escTotal ? ((escAusentes / escTotal) * 100).toFixed(2).replace('.', ',') + "%" : "0,00%";
    sheetData.push([
      "TOTAL ESCOLA",
      "",
      escolaNome,
      "",
      escTotal,
      escAusentes,
      escPresentes,
      escDesistentes,
      "",
      "",
      escEliminados,
      "",
      "",
      percAbst
    ]);
    sheetData.push([]); // linha em branco para separar escolas
  });

  // Adiciona total geral do evento ao final
  const percGeral = totalGeral.total ? ((totalGeral.ausentes / totalGeral.total) * 100).toFixed(2).replace('.', ',') + "%" : "0,00%";
  sheetData.push([
    "TOTAL GERAL",
    "",
    "",
    "",
    totalGeral.total,
    totalGeral.ausentes,
    totalGeral.presentes,
    totalGeral.desistentes,
    "",
    "",
    totalGeral.eliminados,
    "",
    "",
    percGeral
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Abstenção");
  XLSX.writeFile(wb, "relatorio_abstencao.xlsx");
  exibirFeedback("XLSX exportado com sucesso!");
}

// ==== LIMPAR CAMPOS ====
function limparCampos() {
  dados.forEach(sala => {
    if (sala.inputs) {
      sala.inputs.ausenteInput.value = 0;
      sala.inputs.presenteInput.value = parseInt(sala.total) || 0;
      sala.inputs.desistenteInput.value = 0;
      sala.inputs.eliminadoInput.value = 0;
      // Limpa detalhes
      for (let i = 0; i < 10; i++) {
        if (sala.inputs["desistenteInscricao"+i]) sala.inputs["desistenteInscricao"+i].value = "";
        if (sala.inputs["desistenteMotivo"+i]) sala.inputs["desistenteMotivo"+i].value = "";
        if (sala.inputs["eliminadoInscricao"+i]) sala.inputs["eliminadoInscricao"+i].value = "";
        if (sala.inputs["eliminadoMotivo"+i]) sala.inputs["eliminadoMotivo"+i].value = "";
      }
    }
    sala.desistentesDetalhes = [];
    sala.eliminadosDetalhes = [];
  });
  calcularETotalizar();
  exibirFeedback("Campos limpos!");
}

// ==== FILTROS ====
document.getElementById("filtroEvento").addEventListener("change", () => carregarVisualSalas(dados));
document.getElementById("filtroTurno").addEventListener("change", () => carregarVisualSalas(dados));
document.getElementById("filtroEscola").addEventListener("change", () => carregarVisualSalas(dados));

// Função para tentar corrigir encoding Latin1 para UTF-8
function corrigirEncoding(str) {
  if (typeof str !== "string") return str;
  // Detecta símbolos estranhos comuns de encoding errado
  if (/Ã|Â|Ê|Ô|ã|á|é|í|ó|ú/.test(str)) {
    try {
      return decodeURIComponent(escape(str));
    } catch {
      return str;
    }
  }
  return str;
}

function desenharDashboard() {
  console.log("Dashboard chamado! Dados:", dados.length);

  document.getElementById("dashboard-message").innerText = "Dashboard está ativo!";
  document.getElementById("dashboard").style.display = "";

  // Calcule os totais igual ao card
  let total = 0, aus = 0, pres = 0, des = 0, elim = 0;
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  const dadosFiltrados = dados.filter(sala =>
    (eventoFiltro === "" || sala.evento === eventoFiltro) &&
    (turnoFiltro === "" || sala.turno === turnoFiltro) &&
    (escolaFiltro === "" || sala.escola === escolaFiltro)
  );

  dadosFiltrados.forEach(sala => {
    total += parseInt(sala.total) || 0;
    aus += parseInt(sala.ausentes) || 0;
    pres += parseInt(sala.presentes) || 0;
    des += parseInt(sala.desistentes) || 0;
    elim += parseInt(sala.eliminados) || 0;
  });

  // Remova gráficos anteriores se existirem
  if (window.graficoTotais && typeof window.graficoTotais.destroy === "function") {
    window.graficoTotais.destroy();
  }

  // Só desenha o gráfico se houver dados
  if (total > 0) {
    const ctxTotais = document.getElementById('graficoTotais').getContext('2d');
    window.graficoTotais = new Chart(ctxTotais, {
      type: 'pie',
      data: {
        labels: ['Ausentes', 'Presentes', 'Desistentes', 'Eliminados'],
        datasets: [{
          data: [aus, pres, des, elim],
          backgroundColor: [
            '#1976d2', // Ausentes
            '#43a047', // Presentes
            '#ffb300', // Desistentes
            '#d32f2f'  // Eliminados
          ]
        }]
      },
      options: {
        plugins: {
          legend: {display: true, position: 'bottom'},
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const perc = total ? ((value / total) * 100).toFixed(2) : "0.00";
                return `${label}: ${value} (${perc}%)`;
              }
            }
          }
        }
      }
    });
  } else {
    // Se não houver dados, limpa o canvas
    document.getElementById('graficoTotais').getContext('2d').clearRect(0, 0, 320, 200);
  }

  // ... resto do seu código para outros gráficos ...
}
function desenharResumoEvento() {
  let total = 0, aus = 0, pres = 0, des = 0, elim = 0;
  const eventoFiltro = document.getElementById("filtroEvento").value;
  const turnoFiltro = document.getElementById("filtroTurno").value;
  const escolaFiltro = document.getElementById("filtroEscola").value;
  const dadosFiltrados = dados.filter(sala =>
    (eventoFiltro === "" || sala.evento === eventoFiltro) &&
    (turnoFiltro === "" || sala.turno === turnoFiltro) &&
    (escolaFiltro === "" || sala.escola === escolaFiltro)
  );

  dadosFiltrados.forEach(sala => {
    total += parseInt(sala.total) || 0;
    aus += parseInt(sala.ausentes) || 0;
    pres += parseInt(sala.presentes) || 0;
    des += parseInt(sala.desistentes) || 0;
    elim += parseInt(sala.eliminados) || 0;
  });

  // --- GRÁFICO DE PIZZA ---
  if (window.graficoTotais && typeof window.graficoTotais.destroy === "function") {
    window.graficoTotais.destroy();
  }
  if (total > 0) {
    const ctxTotais = document.getElementById('graficoTotais').getContext('2d');
    window.graficoTotais = new Chart(ctxTotais, {
      type: 'pie',
      data: {
        labels: ['Ausentes', 'Presentes', 'Desistentes', 'Eliminados'],
        datasets: [{
          data: [aus, pres, des, elim],
          backgroundColor: [
            '#1976d2',
            '#43a047',
            '#ffb300',
            '#d32f2f'
          ]
        }]
      },
      options: {
        plugins: {
          legend: {display: true, position: 'bottom'},
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const perc = total ? ((value / total) * 100).toFixed(2) : "0.00";
                return `${label}: ${value} (${perc}%)`;
              }
            }
          }
        }
      }
    });
  } else {
    document.getElementById('graficoTotais').getContext('2d').clearRect(0, 0, 150, 150);
  }

  // --- GRÁFICO DE BARRA ---
  if (window.graficoBarraTotais && typeof window.graficoBarraTotais.destroy === "function") {
    window.graficoBarraTotais.destroy();
  }
  if (total > 0) {
    const ctxBarra = document.getElementById('graficoBarraTotais').getContext('2d');
    window.graficoBarraTotais = new Chart(ctxBarra, {
      type: 'bar',
      data: {
        labels: ['Ausentes', 'Presentes', 'Desistentes', 'Eliminados'],
        datasets: [{
          label: 'Total',
          data: [aus, pres, des, elim],
          backgroundColor: [
            '#1976d2',
            '#43a047',
            '#ffb300',
            '#d32f2f'
          ]
        }]
      },
      options: {
        plugins: {legend: {display: false}},
        scales: {y: {beginAtZero: true}}
      }
    });
  } else {
    document.getElementById('graficoBarraTotais').getContext('2d').clearRect(0, 0, 150, 150);
  }
}