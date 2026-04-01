export interface Hospital {
  id: string
  name: string
  contact_person: string
  email: string
  city: string
  partner_since: string
  slug?: string
  logo_url?: string
  primary_color?: string
  created_at: string
}

export interface Ambulance {
  id: string
  code: string
  type: string
  driver_name: string
  driver_phone: string
  driver_pin?: string
  status: 'available' | 'on_trip' | 'maintenance' | 'offline'
  hospital_id: string
  is_hospital_fleet: boolean
  lat: number
  lng: number
  reg_number?: string
  last_service_date?: string
  next_service_date?: string
  created_at: string
}

export interface Ride {
  id: string
  hospital_id: string
  patient_name: string
  patient_phone: string
  patient_age?: number
  patient_gender?: string
  chief_complaint?: string
  pickup_location: string
  destination: string
  urgency: 'Critical' | 'Urgent' | 'Scheduled'
  ambulance_id: string
  ambulance_code?: string
  driver_name: string
  status: 'pending' | 'dispatched' | 'en_route' | 'completed' | 'cancelled'
  response_time_minutes: number | null
  amount: number
  tracking_token?: string
  whatsapp_sent?: boolean
  pickup_lat?: number | null
  pickup_lng?: number | null
  pickup_place_id?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
  destination_place_id?: string | null
  created_at: string
}

export interface Invoice {
  id: string
  hospital_id: string
  period_label: string
  total_rides: number
  subtotal: number
  gst: number
  total: number
  status: 'pending' | 'paid'
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface UserProfile {
  id: string
  user_id: string
  hospital_id: string
}
