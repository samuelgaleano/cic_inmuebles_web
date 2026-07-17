# 7. Planes y pagos (Publica tu inmueble)

Sección donde agentes, inmobiliarias y propietarios trabajan con CIC. Convierte
el documento comercial de planes en una experiencia con **pago en línea**.

## Estructura de la sección

```
/publica ─────────► Hub "Trabaja con nosotros"
   ├─ Soy propietario  ──► /vender     (sin costo · 3% al cerrar · foto/video opcional)
   └─ Soy agente       ──► /publica/agente  (planes con precio + pago Wompi)
                              └─ /publica/condiciones (condiciones de publicación)
```

## Planes (fuente de verdad: `src/lib/config/plans.ts`)

| Plan | Precio | Pago | Para |
|------|--------|------|------|
| Alianza por resultados | $10.000 / 90 días | En línea | Agentes (comisión 50/50) |
| Publicación independiente | $20.000 / mes | En línea | Agentes |
| Paquete Mensual 5 | $75.000 / mes | En línea | Inmobiliarias |
| Paquete Mensual 10 | $150.000 / mes | En línea | Inmobiliarias |
| Anual Aliado 5 | $239.900 / año | En línea | Inmobiliarias |
| Anual Aliado 10 | $399.900 / año | En línea | Inmobiliarias |
| Contenido Profesional | desde $250.000 | WhatsApp (variable) | Todos |
| Gestión de venta (propietario) | 3% al cerrar | Contrato | Propietarios (/vender) |

> Para cambiar un precio o agregar un plan, se edita **solo** `plans.ts`. El
> monto que se cobra se resuelve desde ahí en el servidor.

## Pasarela de pago (Wompi)

- **Misma cuenta que el proyecto XIAOMI.** Se conecta con variables de entorno.
- **El precio no se puede manipular:** el navegador solo manda el `planId`; el
  servidor resuelve el precio desde `plans.ts` y firma el monto. Un usuario no
  puede pagar menos editando la página.
- **Monto correcto en centavos:** pesos × 100 ($10.000 → 1.000.000). Se corrigió
  el error del proyecto de referencia, que cobraba 100× menos.
- **Confirmación segura:** un webhook valida el checksum oficial de Wompi, y si
  falta el secreto de eventos **no acepta nada** (falla cerrado). Al aprobarse un
  pago, llega un correo al negocio.
- **Sin credenciales, falla seguro:** si las variables no están, los botones
  caen a "Contratar por WhatsApp" y no se cobra nada.

## Lo que tienes que hacer tú (una sola vez)

1. **Vercel → CIC → Settings → Environment Variables**, agrega (mismos valores
   que en el proyecto XIAOMI):
   ```
   WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET
   WOMPI_PRIVATE_KEY   (opcional, refuerza la verificación)
   ```
2. **Panel de Wompi → Eventos:** registra la URL del webhook
   `https://www.cicinmuebles.com/api/pagos/wompi/webhook`.
3. Redespliega (o cualquier push). Los botones pasan de WhatsApp a pago en línea
   automáticamente.

## Verificación

`src/lib/integrations/wompi.test.ts` blinda el monto, la firma y la referencia.
La integración se auditó con agentes de seguridad y de UX (sin hallazgos
críticos; el webhook quedó más estricto que el patrón de referencia).
