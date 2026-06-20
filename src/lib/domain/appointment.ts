/**
 * Modelo de dominio de la Cita / Visita.
 *
 * Usado en Fase 2 (agenda). Una cita reserva una franja de un agente para
 * mostrar un inmueble a un cliente. El objetivo de diseño es CONCRETAR la
 * reserva en el mínimo de pasos posible.
 */

export const APPOINTMENT_STATUSES = [
  "solicitada",
  "confirmada",
  "realizada",
  "cancelada",
  "no_asistio",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

export interface Appointment {
  id: string;
  propertyId: string;
  agentId?: string;
  leadId?: string;

  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string;

  /** Inicio de la cita en ISO 8601. */
  inicioEn: string;
  duracionMin: number;

  estado: AppointmentStatus;
  notas?: string;
  creadoEn: string;
}
