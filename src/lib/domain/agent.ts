/**
 * Modelo de dominio del Agente inmobiliario.
 *
 * Usado en Fase 2 (agenda de visitas). Se define aquí para que el esquema y
 * los tipos estén completos desde el inicio. Cada agente puede definir su
 * disponibilidad semanal, sobre la que se ofrecen franjas a los clientes.
 */

export const AGENT_ROLES = ["admin", "agente_master", "agente"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  admin: "Administrador",
  agente_master: "Agente master",
  agente: "Agente",
};

export interface Agent {
  id: string;
  /** Vinculado al usuario de autenticación (Supabase Auth). */
  userId?: string;
  nombre: string;
  email: string;
  telefono?: string;
  fotoUrl?: string;
  rol: AgentRole;
  activo: boolean;
  creadoEn: string;
}

/** Disponibilidad recurrente semanal de un agente. */
export interface AgentAvailability {
  id: string;
  agentId: string;
  /** 0 = domingo ... 6 = sábado. */
  diaSemana: number;
  /** Hora en formato "HH:mm". */
  horaInicio: string;
  horaFin: string;
}
