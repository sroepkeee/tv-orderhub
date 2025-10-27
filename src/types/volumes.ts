export interface OrderVolume {
  id: string;
  order_id: string;
  volume_number: number;
  quantity: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface VolumeTotals {
  total_volumes: number;
  total_weight_kg: number;
  total_cubagem_m3: number;
}

export interface VolumeFormData {
  quantity: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  description?: string;
}
