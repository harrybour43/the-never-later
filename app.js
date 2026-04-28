// ==========================================
// CONFIGURAÇÕES DO GOOGLE CALENDAR API
// ==========================================
const k1 = 'AIzaSyDk';
const k2 = 'cwwIzO3ND6GwU';
const k3 = 'CcOvwHaiMmvMeer3D4';
const API_KEY = k1 + k2 + k3;
const CLIENT_ID = '600915881459-vjgnu8hsnmt105of3j7d8co9qdggvmv2.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Chamado pelo script da API do Google no index.html
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
  gapiInited = true;
}

// Chamado pelo script do Google Identity Services no index.html
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', 
  });
  gisInited = true;
}

// ==========================================
// INTEGRAÇÃO COM AGENDA
// ==========================================
function conectarAgenda() {
  if (!gapiInited || !gisInited) {
    alert("As APIs do Google ainda estão carregando. Tente novamente em um segundo.");
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      console.error(resp.error);
      return;
    }
    await buscarProximoEvento();
  };
  
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    tokenClient.requestAccessToken({prompt: ''});
  }
}

async function buscarProximoEvento() {
  try {
    const request = {
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 1,
      orderBy: 'startTime',
    };
    
    const response = await gapi.client.calendar.events.list(request);
    const eventos = response.result.items;

    if (eventos.length > 0) {
      const evento = eventos[0];
      const inicio = evento.start.dateTime || evento.start.date;
      const local = evento.location || "Local não definido na agenda";
      
      document.getElementById('destino').value = local;
      
      const dataObj = new Date(inicio);
      const horaFormatada = dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
      document.getElementById('hora-comp').value = horaFormatada;
      
      alert(`Mecanismo sincronizado com: ${evento.summary}`);
    } else {
      alert('Nenhum compromisso encontrado para hoje no seu pergaminho digital.');
    }
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
  }
}

// ==========================================
// LÓGICA DO DESATRASADOR (ALARMES E ÁUDIO)
// ==========================================
const sons = {
  green: new Howl({ src: ["https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"], loop: true }),
  yellow: new Howl({ src: ["https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3"], loop: true }),
  red: new Howl({ src: ["https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3"], loop: true }),
};

let monitor;
let alarmes = [];
let ativo = null;
let clockUpdateInterval = null;

function armarDispositivo() {
  const dest = document.getElementById("destino").value;
  const tempo = parseInt(document.getElementById("trajeto").value);
  const anna = document.getElementById("com-anna").checked;
  
  const horaInput = document.getElementById("hora-comp").value;
  if (!dest || !horaInput || isNaN(tempo)) {
    alert("Preencha todos os parâmetros do maquinário.");
    return;
  }

  const [h, m] = horaInput.split(":");
  let dataAlvo = new Date();
  dataAlvo.setHours(h, m, 0, 0);

  // 20% de margem de segurança
  const totalTrajeto = tempo * 1.2; 
  // 1 hora sozinho, 2 horas acompanhado
  const preparo = anna ? 120 : 60; 

  const horaSaida = new Date(dataAlvo.getTime() - totalTrajeto * 60000);
  const horaArrumar = new Date(horaSaida.getTime() - preparo * 60000);

  alarmes = [
    { tipo: "green", cta: "PREPARE-SE", disparo: new Date(horaArrumar.getTime() - 15 * 60000), done: false },
    { tipo: "yellow", cta: "30 MINUTOS", disparo: new Date(horaSaida.getTime() - 30 * 60000), done: false },
    { tipo: "red", cta: "SAIA AGORA!", disparo: new Date(horaSaida.getTime() - 5 * 60000), done: false },
  ];

  document.getElementById("status-board").style.display = "block";
  document.getElementById("st-arrumar").innerText = `Mecanismo de preparo às: ${horaArrumar.toLocaleTimeString('pt-BR', { hour: "2-digit", minute: "2-digit" })}`;
  document.getElementById("st-sair").innerText = `Partida inevitável às: ${horaSaida.toLocaleTimeString('pt-BR', { hour: "2-digit", minute: "2-digit" })}`;

  // Necessário para destravar reprodução automática de áudio no navegador
  Howler.ctx.resume();
  
  if (monitor) clearInterval(monitor);
  monitor = setInterval(() => {
    const agora = new Date();
    alarmes.forEach((a) => {
      if (!a.done && agora >= a.disparo) {
        disparar(a, dest);
        a.done = true;
      }
    });
  }, 1000);
  
  alert("O Desatrasador foi devidamente calibrado.");
}

function disparar(alarmeObj, destino) {
  const overlay = document.getElementById("alarm-overlay");
  const cta = document.getElementById("alarm-cta");
  
  cta.innerText = alarmeObj.cta;
  cta.className = "cta-text lamp-" + alarmeObj.tipo;
  document.getElementById("alarm-info-dest").innerText = destino;
  overlay.style.display = "flex";
  
  if (ativo) ativo.stop();
  ativo = sons[alarmeObj.tipo];
  ativo.play();

  if (clockUpdateInterval) clearInterval(clockUpdateInterval);
  clockUpdateInterval = setInterval(() => {
    if (overlay.style.display === "none") {
      clearInterval(clockUpdateInterval);
    } else {
      document.getElementById("alarm-clock").innerText = new Date().toLocaleTimeString('pt-BR');
    }
  }, 1000);
}

function encerrarAlarme() {
  document.getElementById("alarm-overlay").style.display = "none";
  if (ativo) ativo.stop();
  if (clockUpdateInterval) clearInterval(clockUpdateInterval);
}

// ==========================================
// REGISTRO DO SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('ServiceWorker registrado com sucesso no escopo: ', registration.scope);
      }, (err) => {
        console.error('Falha ao registrar o ServiceWorker: ', err);
      });
  });
}
