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
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        return {};
      }
    }
  };

  const handleTriggerGemini = async () => {
    try {
      const storedData = await new Promise((resolve) => {
        chrome.storage.local.get(['datos_capturados'], resolve);
      });

      const datosCapturados = storedData.datos_capturados || {};
      
      const prompt = `Analiza el siguiente texto extraído de una página web y estructura los datos exactamente en este formato JSON, sin textos adicionales ni marcas markdown:\n{\n  "articulo_nombre": "Nombre del producto encontrado",\n  "costo_final": "Precio numérico encontrado",\n  "unidades_pedidas": "Cantidad encontrada (si no se especifica usa 1)"\n}\n\nTexto:\n"${datosCapturados.texto || ''}"`;

      // 🔑 PON TU NUEVA API KEY DE OPENAI AQUÍ ABAJO:
      const MI_API_KEY = "TU_NUEVA_API_KEY_AQUÍ"; 

      // Llamada directa a OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Error en API OpenAI: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      const responseText = rawData.choices[0].message.content;
      const parsed = parseJsonSafe(responseText);
      
      const result = {
        articulo_nombre: parsed.articulo_nombre || '',
        costo_final: parsed.costo_final || '',
        unidades_pedidas: parsed.unidades_pedidas || '1'
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
            prompt: "Llamada directa",
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
});
