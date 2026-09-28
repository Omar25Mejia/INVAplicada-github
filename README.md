# POS Control

Sistema web de punto de venta e inventario para comercios.

## Incluye
- Dashboard de ventas e inventario
- Punto de venta con carrito
- Lector QR y códigos de barras mediante cámara
- Productos, SKU, código, categorías, costos y precios
- Entradas y salidas de inventario
- Alertas de stock mínimo
- Clientes y proveedores
- Historial de ventas
- Métodos de pago: efectivo, tarjeta, transferencia y QR
- Reporte de ventas de 30 días
- Usuarios con roles: administrador, encargado y cajero
- Auditoría básica de accesos
- PostgreSQL preparado para Railway

## Inicio local

```bash
npm install
DATABASE_URL="postgresql://usuario:password@localhost:5432/pos" npm start
```

Variables recomendadas:
- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_PASSWORD`
- `PORT`

## Acceso inicial

Usuario: `admin`

La contraseña inicial por defecto es `admin123`. En producción se recomienda definir `ADMIN_PASSWORD` y `SESSION_SECRET` en las variables de entorno.
