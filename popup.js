document.addEventListener('DOMContentLoaded', async () => {
  const confidenceBadge = document.getElementById('confidenceBadge');
  const confidenceDescription = document.getElementById('confidenceDescription');
  const aiLogOutput = document.getElementById('aiLogOutput');

  // Elementos de los botones de interacción
  const btnObserve = document.getElementById('btnObserve');
  const btnGemini = document.getElementById('btnGemini');
  const btnAutomate = document.getElementById('btnAutomate');

  const updateStatus = (count) => {
    if (count === 0) {
      confidenceBadge.textContent = 'Vigilado 👁️';
      confidenceDescription.textContent = '0 ejecuciones: supervisión total.';
    } else if (count <= 3) {
      confidenceBadge.textContent = 'Semi-autónomo ⚖️';
      confidenceDescription.textContent = `${count} ejecuciones: operación asistida.`;
    } else {
      confidenceBadge.textContent = 'Autónomo Autónomo 🚀';
      confidenceDescription.textContent = `${count} ejecuciones: confianza alta.`;
    }
  };

  const renderAiLog = (log) => {
    if (!log || typeof log !== 'object') {
      aiLogOutput.textContent = 'No hay registros de ai_log disponibles todavía.';
      aiLogOutput.classList.add('placeholder');
      return;
    }
    aiLogOutput.classList.remove('placeholder');
    aiLogOutput.textContent = JSON.stringify(log, null, 2);
  };

  const loadDataFromStorage = async () => {
    try {
      const stored = await new Promise((resolve) => {
        chrome.storage.local.get(['audit_log', 'ai_log'], resolve);
      });
      const auditLog = Array.isArray(stored.audit_log) ? stored.audit_log : [];
      const aiLog = stored.ai_log || null;
      updateStatus(auditLog.length);
      renderAiLog(aiLog);
    } catch (e) {
      console.error(e);
    }
  };

  // Listeners para disparar las funciones del service worker
  btnObserve.addEventListener('click', () => {
    chrome.runtime.sendMessage('START_OBSERVATION', () => {
      setTimeout(loadDataFromStorage, 1000);
    });
  });

  btnGemini.addEventListener('click', () => {
    aiLogOutput.textContent = "🧠 Solicitando análisis al proxy de Vercel... Por favor espera.";
    chrome.runtime.sendMessage('TRIGGER_GEMINI', (response) => {
      console.log('Respuesta del proxy:', response);
      loadDataFromStorage();
    });
  });

  btnAutomate.addEventListener('click', () => {
    chrome.runtime.sendMessage('START_AUTOMATION', () => {
      setTimeout(loadDataFromStorage, 1000);
    });
  });

  // Carga inicial al abrir el panel
  await loadDataFromStorage();
});