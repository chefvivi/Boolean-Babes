chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const executeContentScript = async (scriptFile) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('No hay pestaña activa disponible.');
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [scriptFile]
      });
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error al inyectar script:', error);
      sendResponse({ success: false, error: error.message });
    }
  };

  const parseJsonSafe = (rawText) => {
    const cleaned = String(rawText || '')
      .replace(/```json\s*/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('No se pudo parsear JSON directamente, intentando extracción manual...', parseError);
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No se encontró bloque JSON en la respuesta.');
        return {};
      }
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        console.error('Error al parsear JSON extraído manualmente.', fallbackError);
        return {};
      }
    }
  };

  const handleTriggerGemini = async () => {
    let prompt = '';
    try {
      const stored = await new Promise((resolve) => {
        chrome.storage.local.get(['datos_capturados'], resolve);
      });
      const datosCapturados = stored && stored.datos_capturados ? stored.datos_capturados : {};

      prompt = `Eres un asistente experto en extracción semántica de datos. Recibe un texto de origen y mapea su contenido hacia estos tres campos exactos: \n- articulo_nombre\n- costo_final\n- unidades_pedidas\n\n` +
        `Para determinar costo_final, usa una comprensión semántica de términos como Price, Precio, Costo, Total, Amount, Value, Subtotal, Monto o Valor. ` +
        `Si el texto incluye símbolos de moneda o separadores locales, ajústalos sin perder exactitud. ` +
        `Si los términos se expresan en diferentes formatos, haz la asociación basada en el significado y no en coincidencias literales.\n\n` +
        `Responde únicamente con un JSON válido sin explicaciones ni markdown. Si algún campo no puede extraerse, déjalo como cadena vacía.\n\n` +
        `Texto de origen:\n${datosCapturados.texto || ''}`;

      const response = await fetch('https://boolean-babes.vercel.app/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`Fetch falló con estado ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      const parsed = parseJsonSafe(responseText);
      const result = {
        articulo_nombre: parsed.articulo_nombre || '',
        costo_final: parsed.costo_final || '',
        unidades_pedidas: parsed.unidades_pedidas || ''
      };

      await new Promise((resolve) => {
        chrome.storage.local.set({
          field_mapping: result,
          ai_log: {
            timestamp: new Date().toISOString(),
            prompt,
            response: responseText,
            parsed,
            status: 'success'
          }
        }, resolve);
      });

      sendResponse({ success: true, field_mapping: result });
    } catch (error) {
      console.error('Error en TRIGGER_GEMINI:', error);
      await new Promise((resolve) => {
        chrome.storage.local.set({
          ai_log: {
            timestamp: new Date().toISOString(),
            prompt,
            error: error.message,
            status: 'failed'
          }
        }, resolve);
      });
      sendResponse({ success: false, error: error.message });
    }
  };

  if (message === 'START_OBSERVATION') {
    executeContentScript('content-observation.js');
    return true;
  }

  if (message === 'START_AUTOMATION') {
    executeContentScript('content-automation.js');
    return true;
  }

  if (message === 'TRIGGER_GEMINI') {
    handleTriggerGemini();
    return true;
  }

  return false;
});
