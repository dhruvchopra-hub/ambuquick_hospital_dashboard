export interface Hospital {
  id: string
  name: string
  contact_person: string
  email: string
  city: string
  partner_since: string
  created_at: string
}

export interface Ambulance {
  id: string
  code: string
  type: string
  driver_name: string
  driver_phone: string
  status: 'available' | 'on_trip' | 'maintenance' | 'offline'
  hospital_id: string
  is_hospital_fleet: boolean
  lat: number
  lng: number
  created_at: string
}

export interface Ride {
  id: string
  hospital_id: string
  patient_name: string
  patient_phone: string
  pickup_location: string
  destination: string
  urgency: 'Critical' | 'Urgent' | 'Scheduled'
  ambulance_id: string
  ambulance_code?: string
  driver_name: string
  status: 'pending' | 'dispatched' | 'en_route' | 'completed' | 'cancelled'
  response_time_minutes: number | null
  amount: number
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
