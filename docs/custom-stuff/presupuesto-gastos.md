- Mantener historico archivar cuando se cumple la fecha o manualmente
- Poder crear mas de 1 al mismo tiempo
- Elegir moneda
- Poder exportar presupuesto
- Poder exportar gastos variables

Diseño CC

Bien, ya tengo el panorama completo. Te lo explico como está HOY y después te doy las opciones de diseño.

Estado actual

Lo que tenés implementado:

- Budget tiene periodStart, periodEnd y un flag isActive (boolean)
- No hay archivado automático — cuando termina el rango de fechas, el presupuesto sigue ahí como si nada
- Solo un presupuesto activo por grupo — cuando activás uno nuevo, el anterior se desactiva automáticamente (toggleActive)
- No hay rollover — no se crea el mes siguiente solo, ni se arrastra lo que sobró/faltó

O sea, HOY un presupuesto queda indefinidamente abierto hasta que vos manualmente creás uno nuevo (y el viejo se desactiva) o lo desactivás con toggleActive.

Las opciones de diseño

Acá hay tres caminos clásicos, cada uno con tradeoffs:

Opción A: Manual (como está hoy, mejorado)

- El usuario crea un presupuesto nuevo cuando quiere
- El anterior queda como "histórico" (visible en una lista de presupuestos pasados vía getByGroup)
- Podés agregar un botón "Duplicar presupuesto" para copiar las huchas del anterior al nuevo período

Pro: Simple, el usuario tiene control total
Contra: Se puede olvidar de crear el nuevo, queda el viejo "vencido" activo

Opción B: Semi-automático

- Cuando el periodEnd pasa, el presupuesto se marca visualmente como "vencido" en la UI (banner amarillo)
- Se le ofrece un CTA: "Crear presupuesto para el siguiente período" (pre-llena con las mismas huchas)
- El viejo se archiva cuando el usuario confirma el nuevo

Pro: Guía al usuario sin forzarlo. Mejor UX sin complejidad de cron jobs
Contra: Un poquito más de UI

Opción C: Automático con rollover

- Un cron job (ya tenés pg_cron) crea automáticamente el siguiente presupuesto al terminar el período
- Opcionalmente arrastra saldos (lo que sobró o lo que se pasó)
- El anterior se archiva automáticamente

Pro: "Set it and forget it"
Contra: Más complejo, el usuario pierde control, hay edge cases (¿qué pasa si no quiero el mes siguiente?)

Mi recomendación

Opción B es el sweet spot para tu caso. ¿Por qué?

1. Ya tenés todo el schema necesario — isActive + periodEnd es suficiente
2. No necesitás cron jobs nuevos ni complejidad en backend
3. Es una mejora de UI pura: detectar periodEnd < now() y mostrar el estado "vencido" + CTA
4. El "Duplicar presupuesto" es un feature de ALTO valor con bajo costo

¿Qué te parece? ¿Querés ir por la B, o tenés otra idea en mente?
