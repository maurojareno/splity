# Budget History / List Feature

> Complejidad: **M** (medium) | Archivos estimados: 5 + 13 locales | Fecha: 2026-04-24

## Contexto

La página de budget solo muestra el último budget activo (`getActive` usa `findFirst` + `orderBy: createdAt desc`). Al crear budgets nuevos, los anteriores quedan `isActive: true` en la DB pero invisibles en la UI. Se necesita poder navegar todos los budgets (activos + archivados), archivarlos, y siempre tener el actual como vista default.

**Regla de negocio**: Un solo budget activo por grupo en todo momento. `isActive: false` = archivado (datos preservados, solo lectura en UI).

## Problemas detectados en el código actual

### Bug 1: `create` no desactiva budgets previos

La mutation `create` NO hace `updateMany` para desactivar anteriores. Se acumulan múltiples budgets con `isActive: true`, pero `getActive` (que usa `findFirst`) solo muestra el más reciente. Inconsistencia silenciosa.

### Bug 2: `toggleActive` puede dejar cero budgets activos

Si el usuario desactiva el ÚNICO budget activo, `getActive` retorna `null` y la página muestra empty state sin forma de volver a activar uno (el botón de historial solo aparece cuando hay un budget activo).

### Potencial issue: `getByGroup` con spending totals

Cargar `charges.amount` para TODOS los envelopes de TODOS los budgets puede ser costoso con muchos budgets. `EnvelopeCharge` tiene index en `envelopeId` pero no en `budgetId` directamente.

### No-issue confirmado: `EnvelopeSelector`

Solo muestra envelopes del budget activo (`getActive`). Esto es correcto — al crear expenses solo querés cargar al budget vigente. No necesita cambios.

### No-issue confirmado: Archive safety

`EnvelopeCharge` y `Envelope` no referencian `isActive`. Archivar un budget (setear `isActive: false`) preserva todos los datos: charges, envelopes, links a expenses. Seguro.

## Approach: AppDrawer con historial de budgets

Un drawer (consistente con el patrón `AppDrawer` de la app) accesible desde un botón al lado de "+ New budget". La página actual de budget sirve como vista de detalle de cualquier budget usando query param `?id=`.

## Cambios

### 1. Backend — `src/server/api/routers/budget.ts`

**Fix `create`** — auto-desactivar budgets previos antes de crear (dentro de transaction):

```ts
// Antes de db.budget.create, dentro de $transaction:
await ctx.db.budget.updateMany({
  where: { groupId: input.groupId, isActive: true },
  data: { isActive: false },
});
```

**Fix `toggleActive`** — prevenir dejar cero budgets activos:

```ts
// Si el budget está activo y es el único activo, impedir desactivación:
if (budget.isActive) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message:
      'Cannot deactivate the only active budget. Create a new one or activate another first.',
  });
}
```

Nota: con la regla "un solo activo por grupo" y el fix de `create`, `toggleActive` solo tiene sentido para RE-ACTIVAR un budget archivado (lo cual desactiva al actual). La rama de "desactivar" se vuelve la acción de "archivar".

**Mejorar `getByGroup`** — agregar totales de gasto LIVIANOS:

- Incluir `envelopes.allocatedAmount` y `envelopes.charges.amount`
- Computar `totalSpent` y `totalAllocated` por budget en el server
- Stripear data cruda de envelopes del response, retornar solo agregados
- Scalability: si a futuro hay muchos budgets, paginar con `take/skip` (no implementar ahora, pero el shape del return lo permite)

**Agregar `getById`** — misma lógica que `getActive` pero filtrada por `budgetId`:

- Valida membership del grupo (via `groupProcedure`)
- Valida que el budget pertenece al grupo (`budget.groupId !== input.groupId` → FORBIDDEN)
- Retorna budget completo con envelopes + spending (mismo shape que `getActive`)
- Si `budgetId` no existe → NOT_FOUND (no silencioso)

### 2. Nuevo Componente — `src/components/Budget/BudgetHistoryDrawer.tsx`

AppDrawer wrapeando una lista de todos los budgets del grupo.

**Layout del item:**

- Nombre del budget (bold) + badge de estado (Active / Archived)
- Rango de fechas (`periodStart` — `periodEnd`)
- `totalSpent / totalAmount` con currency formateado
- Envelope count (e.g. "4 envelopes")
- Budget activo actual resaltado con borde o ring

**Secciones:** Budget activo primero (si existe), después archivados. Ordenados por `periodStart desc`.

**Acciones:**

- Tap en el card → cierra drawer, navega a `?id={budgetId}` (o quita `?id=` si es el activo)
- Botón "Archivar" en cada item activo → llama `toggleActive` (solo cambia el activo actual, desactiva y activa el seleccionado)
- Botón "Activar" en items archivados → llama `toggleActive` (desactiva el actual, activa el seleccionado)
- Invalidar queries: `getActive`, `getByGroup`, y `getById` (si aplica)
- Toast de confirmación

### 3. Budget Page — `src/pages/groups/[groupId]/budget/index.tsx`

**Query param routing:**

- Sin `?id=` → usa `getActive` (comportamiento actual, sin cambios)
- Con `?id=budgetId` → usa nuevo `getById`
- Si `getById` retorna error (not found, forbidden) → redirect a budget page sin `?id=`

**Adiciones UI:**

- Botón de historial (icono `List` de lucide) al lado de "+ New budget" en el header de Envelopes
- Banner de budget archivado cuando se ve uno con `isActive: false`: mensaje info + link "Ver actual"
- Ocultar "Quick add charge" y `AddChargeDrawer` para budgets archivados (read-only)
- Ocultar settings gear para budgets archivados (no se editan)
- Settings gear del budget activo linkea a edit con el budget ID correcto

**Empty state + historial:**

- Agregar `getByGroup` query en `BudgetEmptyState` (solo count check: `{ enabled: true }`)
- Si hay budgets archivados → mostrar link "Ver presupuestos anteriores" que abre el drawer
- Requiere pasar el drawer como prop o usar un state compartido

### 4. Traducciones — los 13+ archivos de locale

Keys nuevas bajo `budget`:

- `budget_history`, `active`, `archived`, `archive_budget`, `restore_budget`
- `budget_archived`, `budget_restored`, `viewing_archived`, `view_current`
- `view_past_budgets`, `no_budgets_found`
- `cannot_deactivate_only` (para error toast)
- `envelopes_count` (para el drawer: "{{count}} envelopes")

## Archivos a modificar

| Archivo                                         | Acción                                                         |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `src/server/api/routers/budget.ts`              | Fix create + toggleActive, mejorar getByGroup, agregar getById |
| `src/components/Budget/BudgetHistoryDrawer.tsx` | **Nuevo** — drawer con lista de budgets                        |
| `src/pages/groups/[groupId]/budget/index.tsx`   | Agregar ?id= routing, botón historial, banner archivado        |
| `src/components/Budget/BudgetEmptyState.tsx`    | Agregar link "Ver presupuestos anteriores" con drawer          |
| `public/locales/*/common.json`                  | Agregar translation keys (13+ archivos)                        |

## Invariantes (reglas que el código debe garantizar)

1. **Un solo budget activo por grupo** — enforced en `create` (desactiva previos) y `toggleActive` (desactiva otros al activar)
2. **Siempre hay al menos un budget activo si hay budgets** — `toggleActive` no permite desactivar el último activo
3. **Budgets archivados son read-only** — UI oculta add charge, edit, quick charge
4. **`getById` valida pertenencia al grupo** — no se puede ver budgets de otros grupos via `?id=`
5. **Data preserved on archive** — archivar solo cambia `isActive`, no borra charges/envelopes

## Verificación

1. Crear un budget → verificar que budgets previos se desactivan automáticamente
2. Intentar desactivar el único budget activo → verificar error/toast
3. Abrir drawer de historial → ver todos los budgets con status correcto
4. Activar un budget archivado desde el drawer → verificar que el actual se desactiva, el nuevo se activa
5. Tap en budget archivado en el drawer → verificar que se muestra read-only (sin add charge, sin settings)
6. Tap "Ver actual" desde banner → vuelve al budget activo
7. Eliminar todos los budgets → empty state con link a historial si hay archivados
8. Navegar a `?id=budgetIdInexistente` → redirect a budget page sin ?id
9. Verificar que las traducciones renderizan en EN y ES como mínimo
10. Con 5+ budgets: verificar que el drawer scrollea correctamente
