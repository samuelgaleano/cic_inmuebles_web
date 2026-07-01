import type { Property, PropertyMedia } from "@/lib/domain";

/**
 * Catálogo de ejemplo (seed) para desarrollo y demostración.
 *
 * Las imágenes son de Unsplash (placeholder). Cuando se conecte la base de datos
 * real, estos datos provendrán de Supabase / Google Drive. Todo el catálogo es
 * de VENTA.
 */

function img(id: string, alt: string, order: number, isCover = false): PropertyMedia {
  return {
    id: `${id}-m${order}`,
    type: "image",
    provider: "external",
    url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`,
    alt,
    order,
    isCover,
  };
}

const now = "2026-06-01T12:00:00.000Z";

export const seedProperties: Property[] = [
  {
    id: "p1",
    codigo: "CIC-0001",
    slug: "apartamento-moderno-el-poblado-medellin",
    titulo: "Apartamento moderno con balcón en El Poblado",
    tipo: "apartamento",
    estado: "disponible",
    precio: 720_000_000,
    administracion: 650_000,
    ubicacion: {
      ciudad: "Medellín",
      sector: "El Poblado",
      conjunto: "Torres de Provenza",
      direccion: "Cra. 35 #7-50",
    },
    caracteristicas: { habitaciones: 3, banos: 2, area: 92 },
    descripcion:
      "Espectacular apartamento en el corazón de El Poblado, con acabados premium, amplios ventanales y balcón con vista a la ciudad. Cocina integral y excelente ubicación cerca de Provenza, parques y centros comerciales.",
    medios: [
      img("photo-1502672260266-1c1ef2d93688", "Sala principal", 0, true),
      img("photo-1493809842364-78817add7ffb", "Sala con vista", 1),
      img("photo-1484154218962-a197022b5858", "Cocina integral", 2),
      img("photo-1505691938895-1758d7feb511", "Habitación principal", 3),
    ],
    propietario: { nombre: "María Restrepo", telefono: "+57 300 111 2233", email: "maria.r@example.com" },
    destacado: true,
    publicado: true,
    creadoEn: now,
    actualizadoEn: now,
  },
  {
    id: "p2",
    codigo: "CIC-0002",
    slug: "casa-campestre-llanogrande-rionegro",
    titulo: "Casa campestre con jardín en Llanogrande",
    tipo: "casa_campestre",
    estado: "en_proceso",
    precio: 1_450_000_000,
    ubicacion: {
      ciudad: "Rionegro",
      sector: "Llanogrande",
      conjunto: "Parcelación El Carmelo",
      direccion: "Vereda Llanogrande km 3",
    },
    caracteristicas: { habitaciones: 4, banos: 4, area: 280 },
    descripcion:
      "Hermosa casa campestre rodeada de naturaleza, ideal para descanso o vivienda permanente. Amplios espacios sociales, jardín privado, chimenea y excelente clima. A pocos minutos del aeropuerto José María Córdova.",
    medios: [
      img("photo-1568605114967-8130f3a36994", "Fachada", 0, true),
      img("photo-1512917774080-9991f1c4c750", "Vista exterior", 1),
      img("photo-1600585154340-be6161a56a0c", "Sala", 2),
    ],
    propietario: { nombre: "Carlos Gómez", telefono: "+57 301 222 3344" },
    destacado: true,
    publicado: true,
    creadoEn: now,
    actualizadoEn: now,
  },
  {
    id: "p3",
    codigo: "CIC-0003",
    slug: "apartaestudio-chapinero-bogota",
    titulo: "Apartaestudio remodelado en Chapinero",
    tipo: "apartaestudio",
    estado: "disponible",
    precio: 320_000_000,
    administracion: 320_000,
    ubicacion: {
      ciudad: "Bogotá",
      sector: "Chapinero",
      conjunto: "Edificio Sesenta",
      direccion: "Calle 60 #9-20",
    },
    caracteristicas: { habitaciones: 1, banos: 1, area: 38 },
    descripcion:
      "Acogedor apartaestudio remodelado, listo para habitar, en una de las zonas más conectadas de Bogotá. Cerca de universidades, transporte y zona gastronómica.",
    medios: [
      img("photo-1560448204-e02f11c3d0e2", "Espacio principal", 0, true),
      img("photo-1522708323590-d24dbb6b0267", "Zona social", 1),
    ],
    propietario: { nombre: "Ana Torres", telefono: "+57 310 333 4455" },
    destacado: false,
    publicado: true,
    creadoEn: now,
    actualizadoEn: now,
  },
  {
    id: "p4",
    codigo: "CIC-0004",
    slug: "casa-familiar-ciudad-jardin-cali",
    titulo: "Casa familiar amplia en Ciudad Jardín",
    tipo: "casa",
    estado: "disponible",
    precio: 980_000_000,
    ubicacion: {
      ciudad: "Cali",
      sector: "Ciudad Jardín",
      conjunto: "Conjunto Los Almendros",
      direccion: "Cra. 105 #16-40",
    },
    caracteristicas: { habitaciones: 4, banos: 3, area: 210 },
    descripcion:
      "Casa espaciosa en conjunto cerrado, perfecta para familias. Cuenta con amplios espacios, patio, estudio y excelente iluminación natural. Sector tranquilo y seguro.",
    medios: [
      img("photo-1600596542815-ffad4c1539a9", "Fachada", 0, true),
      img("photo-1600607687939-ce8a6c25118c", "Interior", 1),
    ],
    propietario: { nombre: "Jorge Lozano", telefono: "+57 312 444 5566" },
    destacado: false,
    publicado: true,
    creadoEn: now,
    actualizadoEn: now,
  },
  {
    id: "p5",
    codigo: "CIC-0005",
    slug: "apartamento-vista-mar-bocagrande-cartagena",
    titulo: "Apartamento con vista al mar en Bocagrande",
    tipo: "apartamento",
    estado: "vendido",
    precio: 1_100_000_000,
    administracion: 900_000,
    ubicacion: {
      ciudad: "Cartagena",
      sector: "Bocagrande",
      conjunto: "Edificio Marbella",
      direccion: "Av. San Martín #6-100",
    },
    caracteristicas: { habitaciones: 3, banos: 3, area: 110 },
    descripcion:
      "Exclusivo apartamento frente al mar Caribe, con acabados de lujo y vistas inigualables. Edificio con amplias zonas comunes y ubicación privilegiada en Bocagrande.",
    medios: [
      img("photo-1545324418-cc1a3fa10c00", "Edificio", 0, true),
      img("photo-1502005229762-cf1b2da7c5d6", "Interior", 1),
    ],
    propietario: { nombre: "Lucía Pérez", telefono: "+57 315 555 6677" },
    destacado: false,
    publicado: true,
    creadoEn: now,
    actualizadoEn: now,
  },
];
