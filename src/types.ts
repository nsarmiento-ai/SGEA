export type EquipmentStatus = 'Disponible' | 'Prestado' | 'Fuera de Servicio' | 'Archivado';

export type PiezaEstado = 'OK' | 'Dañado' | 'Faltante';

export interface Pieza {
  id: string;
  nombre: string;
  estado: PiezaEstado;
  obligatorio: boolean;
}

export interface Equipment {
  id: string;
  nombre: string;
  categoria: string;
  modelo: string;
  numero_serie: string;
  ubicacion: string;
  descripcion: string;
  foto_url: string;
  estado: EquipmentStatus;
  restriccion: string | boolean;
  piezas: Pieza[]; // JSONB array of objects
  created_at?: string;
  updated_at?: string;
}

export interface Responsable {
  id: string;
  nombre_completo: string;
  email?: string;
  activo: boolean;
  creado_at: string;
}

export type LoanStatus = 'Activo' | 'Finalizado' | 'En Mora';

export interface Loan {
  id: string;
  alumno_nombre: string;
  alumno_dni: string;
  materia: string;
  docente_responsable: string;
  responsable_nombre: string;
  fecha_salida: string;
  fecha_devolucion_estimada: string;
  estado: LoanStatus;
  equipos_ids: string[]; // Array of equipment IDs
  comentarios?: string;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  created_at: string;
  responsable_nombre: string;
  accion: string;
  detalles: any;
}

export interface Reservation {
  id: string;
  equipos_ids: string[]; // Array of equipment IDs
  usuario_id: string;
  docente_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'Pendiente' | 'Entregada' | 'Cancelada' | 'Activa';
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  rol: 'Pañolero' | 'Docente' | null;
  favoritos: string[];
  created_at?: string;
}
