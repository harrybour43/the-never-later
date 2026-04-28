// ==========================================
// CONFIGURAÇÕES DO GOOGLE CALENDAR API
// (A leitura de agenda não cobra faturamento na camada gratuita)
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

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
  gapiInited = true;
}

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
// ASTROLÁBIO OPEN-SOURCE (Nominatim + Haversine)
// ==========================================
async function calcularTrajetoOpenSource() {
  const destino = document.getElementById('destino').value;
  
  if (!destino) {
    alert("Informe um destino para o astrolábio cartografar.");
    return;
  }

  if (!navigator.geolocation) {
    alert("Seu equipamento não suporta geolocalização.");
    return;
  }

  document.getElementById('trajeto').value = "..."; 

  navigator.geolocation.getCurrentPosition(async (position) => {
    const latOrigem = position.coords.latitude;
    const lonOrigem = position.coords.longitude;

    try {
      // 1. Busca coordenadas no OpenStreetMap (Sem chave, sem custo)
      // O sufixo "São Paulo, SP" garante a precisão da geocodificação
      const busca = encodeURIComponent(`${destino}, São Paulo, SP`);
      const respostaOSM = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${busca}&limit=1`);
      const dadosOSM = await respostaOSM.json();

      if (dadosOSM.length === 0) {
        alert("O cartógrafo não encontrou esse destino. Seja mais específico (ex: nome da rua).");
        document.getElementById('trajeto').value = "30";
        return;
      }

      const latDestino = parseFloat(dadosOSM[0].lat);
      const lonDestino = parseFloat(dadosOSM[0].lon);

      // 2. Cálculo de distância geométrica (Haversine)
      const R = 6371; // Raio da Terra em km
      const dLat = (latDestino - latOrigem) * Math.PI / 180;
      const dLon = (lonDestino - lonOrigem) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(latOrigem * Math.PI / 180) * Math.cos(latDestino * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const distanciaKm = R * c;

      // 3. Extrapolação Multimodal (Metrô/Ônibus/Trem)
      // Multiplicador 1.4 converte linha reta em caminhos viários (grid)
      // 15 km/h é a velocidade média real do transporte público ponta a ponta
      const distanciaReal = distanciaKm * 1.4;
      const tempoHoras = distanciaReal / 15;
      let tempoMinutos = Math.ceil(tempoHoras * 60);

      // Define um tempo mínimo lógico (ninguém se teletransporta)
      tempoMinutos = Math.max(15, tempoMinutos);

      document.getElementById('trajeto').value = tempoMinutos;
      alert(`Cartografia finalizada: ~${tempoMinutos} minutos estimados via transporte público.`);

    } catch (erro) {
      console.error("Erro no astrolábio:", erro);
      alert("Falha de rede ao consultar o OpenStreetMap.");
      document.getElementById('trajeto').value = "30";
    }
    
  }, (error) => {
    alert("O acesso à bússola (GPS) foi bloqueado. Verifique as permissões do navegador.");
    document.getElementById('trajeto').value = "30";
  });
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

  const totalTrajeto = tempo * 1.2; 
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
