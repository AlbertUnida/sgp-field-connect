import { describe, it, expect } from "vitest";
import { procesarFilas, mapearFila, type Referencias } from "./importar-cartera";

const ref: Referencias = {
  categorias: [
    { id: "cat-gastro", nombre: "Gastronomía" },
    { id: "cat-hotel", nombre: "Hotelería" },
  ],
  rubros: [
    { id: "rub-bar", nombre: "Bar", categoria_id: "cat-gastro" },
    { id: "rub-resto", nombre: "Restaurante", categoria_id: "cat-gastro" },
    { id: "rub-hotel", nombre: "Hotel", categoria_id: "cat-hotel" },
  ],
  subRubros: [{ id: "sub-pub", nombre: "Pub", rubro_id: "rub-bar" }],
  ejecutivos: [
    { id: "eje-1", nombre: "Juan", apellido: "Pérez", email: "juan@sgp.py" },
    { id: "eje-2", nombre: "María", apellido: "Gómez", email: "maria@sgp.py" },
  ],
};

describe("mapearFila (alias de encabezados)", () => {
  it("mapea encabezados con acentos, mayúsculas y sinónimos", () => {
    const d = mapearFila({ "Nombre del Local": "Bar Don Pedro", "MONTO": "500000", "Latitud": "-25.3" });
    expect(d.nombre_comercial).toBe("Bar Don Pedro");
    expect(d.tarifa_mensual).toBe("500000");
    expect(d.lat).toBe("-25.3");
  });

  it("ignora columnas desconocidas y vacías", () => {
    const d = mapearFila({ nombre: "X", columna_rara: "z", ciudad: "  " });
    expect(d.nombre_comercial).toBe("X");
    expect(d).not.toHaveProperty("columna_rara");
    expect(d).not.toHaveProperty("ciudad");
  });
});

describe("procesarFilas — fila válida (local)", () => {
  it("resuelve categoría, rubro, sub-rubro y ejecutivo a ids", () => {
    const { validas, rechazadas } = procesarFilas(
      [{ nombre: "Bar Don Pedro", categoria: "gastronomia", rubro: "BAR", sub_rubro: "pub", ejecutivo: "juan@sgp.py", direccion: "Av. España 123", monto: "500.000" }],
      ref
    );
    expect(rechazadas).toHaveLength(0);
    expect(validas).toHaveLength(1);
    const p = validas[0].payload;
    expect(p.categoria_id).toBe("cat-gastro");
    expect(p.rubro_id).toBe("rub-bar");
    expect(p.sub_rubro_id).toBe("sub-pub");
    expect(p.ejecutivo_id).toBe("eje-1");
    expect(p.tarifa_mensual).toBe(500000);
    expect(p.tipo_cliente).toBe("local");
    expect(p.instancia).toBe("CENSO");
    expect(validas[0].fila).toBe(2);
  });

  it("resuelve ejecutivo por 'nombre apellido'", () => {
    const { validas } = procesarFilas(
      [{ nombre: "Resto Sur", categoria: "Gastronomía", rubro: "Restaurante", ejecutivo: "maría gómez", direccion: "x" }],
      ref
    );
    expect(validas[0].payload.ejecutivo_id).toBe("eje-2");
  });
});

describe("procesarFilas — rechazos", () => {
  it("rechaza sin nombre comercial", () => {
    const { rechazadas } = procesarFilas([{ categoria: "Gastronomía", rubro: "Bar" }], ref);
    expect(rechazadas[0].errores.join()).toMatch(/nombre comercial/i);
  });

  it("rechaza categoría/rubro inexistentes", () => {
    const { rechazadas } = procesarFilas([{ nombre: "X", categoria: "Inexistente", rubro: "Bar" }], ref);
    expect(rechazadas[0].errores.join()).toMatch(/categoría "Inexistente" no existe/i);
  });

  it("rechaza rubro que no pertenece a la categoría", () => {
    const { rechazadas } = procesarFilas([{ nombre: "X", categoria: "Gastronomía", rubro: "Hotel" }], ref);
    expect(rechazadas[0].errores.join()).toMatch(/no pertenece/i);
  });

  it("rechaza ejecutivo inexistente", () => {
    const { rechazadas } = procesarFilas(
      [{ nombre: "X", categoria: "Gastronomía", rubro: "Bar", ejecutivo: "fulano@nadie.com" }],
      ref
    );
    expect(rechazadas[0].errores.join()).toMatch(/ejecutivo .* no encontrado/i);
  });

  it("rechaza instancia inválida", () => {
    const { rechazadas } = procesarFilas(
      [{ nombre: "X", categoria: "Gastronomía", rubro: "Bar", instancia: "VENTAS" }],
      ref
    );
    expect(rechazadas[0].errores.join()).toMatch(/instancia inválida/i);
  });
});

describe("procesarFilas — reglas de negocio y advertencias", () => {
  it("un evento se fuerza a COMERCIAL aunque digan otra cosa", () => {
    const { validas } = procesarFilas(
      [{ nombre: "Salón Talleyrand", tipo: "evento", instancia: "COBRANZAS" }],
      ref
    );
    expect(validas[0].payload.instancia).toBe("COMERCIAL");
    expect(validas[0].payload.categoria_id).toBeNull();
    expect(validas[0].advertencias.join()).toMatch(/COMERCIAL/);
  });

  it("evento no exige categoría/rubro", () => {
    const { validas, rechazadas } = procesarFilas([{ nombre: "Venue X", tipo: "evento" }], ref);
    expect(rechazadas).toHaveLength(0);
    expect(validas[0].payload.tipo_cliente).toBe("evento");
  });

  it("advierte por RUC dudoso pero no rechaza", () => {
    const { validas } = procesarFilas(
      [{ nombre: "X", categoria: "Gastronomía", rubro: "Bar", ruc: "no-es-ruc!" }],
      ref
    );
    expect(validas).toHaveLength(1);
    expect(validas[0].advertencias.join()).toMatch(/RUC/);
  });

  it("acepta coordenadas válidas e ignora inválidas con advertencia", () => {
    const ok = procesarFilas([{ nombre: "X", categoria: "Gastronomía", rubro: "Bar", lat: "-25,30", lng: "-57,60" }], ref);
    expect(ok.validas[0].payload.lat).toBeCloseTo(-25.3, 5);
    expect(ok.validas[0].payload.lng).toBeCloseTo(-57.6, 5);

    const mal = procesarFilas([{ nombre: "Y", categoria: "Gastronomía", rubro: "Bar", lat: "999" }], ref);
    expect(mal.validas[0].payload.lat).toBeNull();
    expect(mal.validas[0].advertencias.join()).toMatch(/coordenadas/i);
  });

  it("ignora filas totalmente vacías", () => {
    const { validas, rechazadas } = procesarFilas([{ nombre: "", ciudad: "" }, {}], ref);
    expect(validas).toHaveLength(0);
    expect(rechazadas).toHaveLength(0);
  });
});
