export type Role = "Admin" | "Receptionist" | "Housekeeping" | "Guest";
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  guest_id: number | null;
  phone: string;
}
export interface Hotel {
  hotel_name: string;
  check_in_time: string;
  check_out_time: string;
  timezone: string;
  today: string;
  local_time: string;
}
export interface RoomType {
  id: number;
  name: string;
  description: string;
  capacity: number;
  base_price_per_night: string;
  is_active: boolean;
  available_rooms?: number;
  number_of_nights?: number;
  total_stay_cost?: string;
}
export interface Room {
  id: number;
  room_number: string;
  room_type_id: number;
  room_type_name: string;
  floor: number;
  notes: string;
  is_active: boolean;
  occupancy_status: string;
  housekeeping_status: string;
  operational_status: string;
  is_ready: boolean;
}
export interface Reservation {
  id: number;
  reference: string;
  guest_id: number;
  guest_name: string;
  guest_email: string;
  room_type_id: number;
  room_type_name: string;
  assigned_room_id: number | null;
  room_number: string | null;
  room_ready: boolean;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  number_of_nights: number;
  price_per_night: string;
  total_stay_cost: string;
  status: string;
  created_at: string;
  updated_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
}
export interface Task {
  id: number;
  room_id: number;
  room_number: string;
  room_type_name: string;
  floor: number;
  status: string;
  priority: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
}
export interface Guest {
  id: number;
  name: string;
  email: string | null;
  phone: string;
}
export interface Issue {
  id: number;
  room_id: number;
  room_number: string;
  description: string;
  status: string;
  reported_at: string;
}
export interface DashboardData {
  today: string;
  counts?: Record<string, number>;
  arrivals?: Reservation[];
  departures?: Reservation[];
  rooms?: Room[];
  recent?: Reservation[];
  open_issues?: number;
  reservations?: Reservation[];
  tasks?: Task[];
}
