(async function() {
  try {
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(['field_mapping', 'audit_log'], resolve);
    });

    const fieldMapping = stored.field_mapping || {};
    const auditLog = Array.isArray(stored.audit_log) ? stored.audit_log : [];

    const parseCost = (value) => {
      if (typeof value !== 'string' && typeof value !== 'number') {
        return NaN;
      }
      let normalized = String(value).trim();
      normalized = normalized.replace(/[^\d,.-]/g, '');
      if (!normalized) {
        return NaN;
      }
      const commaCount = (normalized.match(/,/g) || []).length;
      const dotCount = (normalized.match(/\./g) || []).length;
      if (commaCount > 0 && dotCount === 0) {
        normalized = normalized.replace(/,/g, '.');
      } else if (commaCount > 0 && dotCount > 0) {
        const lastSeparator = normalized.lastIndexOf('.') > normalized.lastIndexOf(',') ? '.' : ',';
        normalized = normalized.replace(new RegExp(`[.,](?=.*[.,])`, 'g'), '');
        if (lastSeparator === ',') {
          normalized = normalized.replace(/,/g, '.');
        }
      }
      return Number(normalized);
    };

    const historicalCosts = auditLog.flatMap((entry) => {
      if (!entry.updatedFields || !Array.isArray(entry.updatedFields)) {
        return [];
      }
      return entry.updatedFields
        .filter((item) => item.field === 'costo_final' && item.value != null)
        .map((item) => parseCost(item.value))
        .filter((value) => !Number.isNaN(value));
    });

    const averageCost = historicalCosts.length
      ? historicalCosts.reduce((sum, value) => sum + value, 0) / historicalCosts.length
      : null;

    const currentCost = parseCost(fieldMapping.costo_final || '');
    const anomalyDetected = averageCost !== null && !Number.isNaN(currentCost) && currentCost > averageCost * 3;

    if (anomalyDetected) {
      const alertState = {
        status: 'Alerta por Discrepancia',
        timestamp: new Date().toISOString(),
        message: 'Costo final anómalo 3x mayor que el promedio histórico. Se sugiere aplicar descuento de retención o regalo para compensar el error operativo con el cliente.',
        averageCost,
        currentCost,
        previousEntries: historicalCosts.length
      };

      const warningEntry = {
        timestamp: alertState.timestamp,
        source: 'content-automation.js',
        warning: 'Detención por anomalía de costo final 3x superior al promedio histórico.',
        alertState
      };

      auditLog.push(warningEntry);
      await new Promise((resolve) => {
        chrome.storage.local.set({ audit_log: auditLog, alert_state: alertState }, resolve);
      });

      alert(`Automatización detenida: discrepancia detectada en costo_final. Valor actual: ${currentCost}, promedio histórico: ${averageCost}.`);
      return;
    }

    const findFieldElement = (key) => {
      const normalizedKey = String(key).toLowerCase();
      const candidates = Array.from(document.querySelectorAll('[id], [name]'));
      return candidates.find((element) => {
        const idValue = String(element.id || '').toLowerCase();
        const nameValue = String(element.getAttribute('name') || '').toLowerCase();
        return idValue === normalizedKey || nameValue === normalizedKey;
      });
    };

    const entries = [
      { key: 'articulo_nombre', value: fieldMapping.articulo_nombre || '' },
      { key: 'costo_final', value: fieldMapping.costo_final || '' },
      { key: 'unidades_pedidas', value: fieldMapping.unidades_pedidas || '' }
    ];

    const updatedFields = [];
    const skippedFields = [];
    const injectionErrors = [];

    entries.forEach(({ key, value }) => {
      try {
        const element = findFieldElement(key);
        if (!element) {
          skippedFields.push({ field: key, reason: 'Elemento no encontrado' });
          return;
        }

        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        updatedFields.push({ field: key, value });
      } catch (fieldError) {
        injectionErrors.push({ field: key, error: fieldError.message });
      }
    });

    const auditEntry = {
      timestamp: new Date().toISOString(),
      source: 'content-automation.js',
      updatedFields,
      skippedFields,
      injectionErrors
    };

    auditLog.push(auditEntry);
    await new Promise((resolve) => {
      chrome.storage.local.set({ audit_log: auditLog }, resolve);
    });

    const successCount = updatedFields.length;
    const summary = successCount
      ? `Transcripción autónoma completada. Campos actualizados: ${updatedFields.map((item) => `${item.field}='${item.value}'`).join(', ')}.`
      : 'No se encontraron campos compatibles para transcripción autónoma.';

    if (injectionErrors.length > 0) {
      console.warn('Errores de inyección de campo detectados:', injectionErrors);
    }

    alert(summary);
  } catch (error) {
    console.error('Error en content-automation.js:', error);
    alert('Error al completar la transcripción autónoma.');
  }
})();
