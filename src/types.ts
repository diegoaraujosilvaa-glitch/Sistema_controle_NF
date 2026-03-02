export interface Vehicle {
  plate: string;
  model?: string;
  driver_name?: string;
}

export interface Movement {
  id: number | string;
  nfe_key: string;
  operation_type: 'Entrada' | 'Saída';
  status: 'Concluída' | 'Retorno ao CD' | 'Recusada' | 'Saída por Recusa';
  reason?: string;
  vehicle_plate: string;
  timestamp: string;
}

export type OperationType = 'Entrada' | 'Saída';
export type OperationStatus = 'Concluída' | 'Retorno ao CD' | 'Recusada' | 'Saída por Recusa';
