// Catalogo de departamentos: id (usado en el boton de WhatsApp) -> nombre visible + numero de destino
function buildDepartments() {
  return [
    {
      id: "dept_contabilidad",
      title: "Contabilidad",
      description: "Facturas, pagos y cuentas",
      phone: process.env.DEPT_CONTABILIDAD,
    },
    {
      id: "dept_punto_de_venta",
      title: "Punto de Venta",
      description: "Ventas y atencion al publico",
      phone: process.env.DEPT_PUNTO_DE_VENTA,
    },
    {
      id: "dept_administracion",
      title: "Administracion",
      description: "Gestion general",
      phone: process.env.DEPT_ADMINISTRACION,
    },
    {
      id: "dept_programacion_produccion",
      title: "Programacion y Prod.",
      description: "Pedidos y produccion",
      phone: process.env.DEPT_PROGRAMACION_PRODUCCION,
    },
  ];
}

module.exports = { buildDepartments };
