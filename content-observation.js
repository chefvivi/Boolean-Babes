(async function() {
  try {
    const capturedData = {
      url: window.location.href,
      texto: document.body ? document.body.innerText : '',
      html: document.body ? String(document.body.innerHTML).slice(0, 5000) : '',
      timestamp: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ datos_capturados: capturedData }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });

    alert('Captura de contenido completada correctamente.');
  } catch (error) {
    console.error('Error al capturar contenido:', error);
    alert('No se pudo completar la captura de contenido.');
  }
})();
