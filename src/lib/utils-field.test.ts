import { describe, it, expect } from "vitest";
import { addBusinessHours, distanciaMetros, filtrarTiposResultado, ordenarRutaVecinoMasCercano } from "./utils-field";

describe("addBusinessHours", () => {
  it("suma horas dentro del mismo día hábil", () => {
    // 2026-07-06 es lunes
    const inicio = new Date(2026, 6, 6, 9, 0, 0);
    const fin = addBusinessHours(inicio, 8);
    expect(fin.getDate()).toBe(6);
    expect(fin.getHours()).toBe(17);
  });

  it("no cuenta horas que caen en fin de semana", () => {
    // 2026-07-11 es sábado; 1 hora hábil debe caer recién el lunes 13
    const inicio = new Date(2026, 6, 11, 10, 0, 0);
    const fin = addBusinessHours(inicio, 1);
    expect(fin.getDay()).toBe(1); // lunes
    expect(fin.getDate()).toBe(13);
  });

  it("cruza el fin de semana desde el viernes", () => {
    // 2026-07-10 viernes 23:00 + 2h hábiles → lunes 13
    const inicio = new Date(2026, 6, 10, 23, 0, 0);
    const fin = addBusinessHours(inicio, 2);
    expect(fin.getDay()).toBe(1);
    expect(fin.getDate()).toBe(13);
  });
});

describe("distanciaMetros", () => {
  it("es 0 entre el mismo punto", () => {
    expect(distanciaMetros({ lat: -25.3, lng: -57.6 }, { lat: -25.3, lng: -57.6 })).toBe(0);
  });

  it("~111 km por grado de latitud", () => {
    const d = distanciaMetros({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it("es simétrica", () => {
    const a = { lat: -25.28, lng: -57.63 };
    const b = { lat: -25.30, lng: -57.60 };
    expect(distanciaMetros(a, b)).toBeCloseTo(distanciaMetros(b, a), 6);
  });

  it("distancia corta razonable (~cientos de metros)", () => {
    const a = { lat: -25.3000, lng: -57.6000 };
    const b = { lat: -25.3020, lng: -57.6000 }; // ~222 m al sur
    const d = distanciaMetros(a, b);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(250);
  });
});

describe("filtrarTiposResultado", () => {
  const tipos = [
    { id: "a", tipo_formulario: "nota_comercial", tipo_cartera: "ambos", orden: 1 },
    { id: "b", tipo_formulario: "nota_reclamo", tipo_cartera: "local", orden: 1 },
    { id: "c", tipo_formulario: "nota_reclamo", tipo_cartera: "local", orden: 2 },
    { id: "d", tipo_formulario: "visita_seguimiento", tipo_cartera: "evento", orden: 1 },
  ];

  it("filtra por cartera (ambos + coincidente)", () => {
    const r = filtrarTiposResultado(tipos, "local", new Set());
    const ids = r.map((t) => t.id);
    expect(ids).toContain("a"); // ambos
    expect(ids).not.toContain("d"); // evento, excluido
  });

  it("muestra solo el próximo nota_reclamo pendiente (secuencial)", () => {
    const r = filtrarTiposResultado(tipos, "local", new Set());
    expect(r.map((t) => t.id)).toEqual(["a", "b"]); // b = orden 1, primer reclamo
  });

  it("avanza al siguiente reclamo cuando el anterior está completado", () => {
    const r = filtrarTiposResultado(tipos, "local", new Set(["b"]));
    expect(r.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("no muestra reclamos cuando todos están completados", () => {
    const r = filtrarTiposResultado(tipos, "local", new Set(["b", "c"]));
    expect(r.map((t) => t.id)).toEqual(["a"]);
  });
});


describe("ordenarRutaVecinoMasCercano", () => {
  const start = { lat: 0, lng: 0 };
  // Puntos sobre una línea de longitud, desordenados
  const p = (id: string, lng: number) => ({ id, lat: 0, lng });

  it("encadena por vecino más cercano desde el inicio", () => {
    const paradas = [p("c", 3), p("a", 1), p("b", 2)];
    const orden = ordenarRutaVecinoMasCercano(paradas, start).map((x) => x.id);
    expect(orden).toEqual(["a", "b", "c"]);
  });

  it("deja las paradas sin coordenadas al final", () => {
    const paradas = [
      { id: "x", lat: null, lng: null },
      { id: "a", lat: 0, lng: 1 },
      { id: "b", lat: 0, lng: 2 },
    ];
    const orden = ordenarRutaVecinoMasCercano(paradas, start).map((x) => x.id);
    expect(orden).toEqual(["a", "b", "x"]);
  });

  it("sin inicio devuelve la lista tal cual", () => {
    const paradas = [p("c", 3), p("a", 1)];
    expect(ordenarRutaVecinoMasCercano(paradas, null)).toEqual(paradas);
  });

  it("elige el vecino más cercano aunque no sea el más cercano al inicio", () => {
    // Desde 0: el más cercano es a(1). Luego desde a(1), el más cercano es b(2), no d(10).
    const paradas = [p("d", 10), p("b", 2), p("a", 1)];
    const orden = ordenarRutaVecinoMasCercano(paradas, start).map((x) => x.id);
    expect(orden).toEqual(["a", "b", "d"]);
  });
});
