import { NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// This route seeds demo data into Firestore. Visit /api/seed once after setup.

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

export async function GET() {
  try {
    const db = getAdminDb()
    const hospitalId = 'hospital_ujala_001'

    // Create hospital
    await db.collection('hospitals').doc(hospitalId).set({
      name: 'Ujala Cygnus Hospital',
      contact_person: 'Dr. Rajesh Sharma',
      email: 'demo@ujala.com',
      city: 'New Delhi',
      partner_since: '2023-01-15',
      created_at: new Date().toISOString(),
    })

    // Create ambulances
    const ambulances = [
      { code: 'AQ-DL-001', type: 'BLS', driver_name: 'Ravi Kumar', driver_phone: '9811234567', status: 'available', is_hospital_fleet: false, lat: 28.6428, lng: 77.2173 },
      { code: 'AQ-DL-002', type: 'ALS', driver_name: 'Suresh Singh', driver_phone: '9822345678', status: 'on_trip', is_hospital_fleet: false, lat: 28.6280, lng: 77.2090 },
      { code: 'UC-DL-001', type: 'BLS', driver_name: 'Amit Yadav', driver_phone: '9833456789', status: 'available', is_hospital_fleet: true, lat: 28.6139, lng: 77.2295 },
      { code: 'UC-DL-002', type: 'hospital_fleet', driver_name: 'Deepak Verma', driver_phone: '9844567890', status: 'maintenance', is_hospital_fleet: true, lat: 28.6350, lng: 77.2000 },
    ]

    const ambIds: string[] = []
    for (const amb of ambulances) {
      const ref = await db.collection('hospitals').doc(hospitalId).collection('ambulances').add({
        ...amb, hospital_id: hospitalId, created_at: new Date().toISOString(),
      })
      ambIds.push(ref.id)
    }

    // Helper to get date N days ago
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString()
    }

    // Create rides
    const rides = [
      // Completed rides - various months
      { patient_name: 'Priya Mehta', patient_phone: '9876543210', pickup_location: 'Rohini Sector 7, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 9, amount: 2500, created_at: daysAgo(2) },
      { patient_name: 'Arjun Sharma', patient_phone: '9765432109', pickup_location: 'Pitampura, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'completed', response_time_minutes: 14, amount: 2000, created_at: daysAgo(3) },
      { patient_name: 'Sunita Devi', patient_phone: '9654321098', pickup_location: 'Model Town, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Scheduled', ambulance_id: ambIds[2], ambulance_code: 'UC-DL-001', driver_name: 'Amit Yadav', status: 'completed', response_time_minutes: 22, amount: 1200, created_at: daysAgo(4) },
      { patient_name: 'Rahul Gupta', patient_phone: '9543210987', pickup_location: 'Shalimar Bagh, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 11, amount: 2500, created_at: daysAgo(5) },
      { patient_name: 'Kavita Singh', patient_phone: '9432109876', pickup_location: 'Ashok Vihar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'completed', response_time_minutes: 17, amount: 2000, created_at: daysAgo(6) },
      { patient_name: 'Manoj Tiwari', patient_phone: '9321098765', pickup_location: 'Kingsway Camp, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 8, amount: 2500, created_at: daysAgo(8) },
      { patient_name: 'Rekha Agarwal', patient_phone: '9210987654', pickup_location: 'Wazirpur, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Scheduled', ambulance_id: ambIds[2], ambulance_code: 'UC-DL-001', driver_name: 'Amit Yadav', status: 'completed', response_time_minutes: 19, amount: 1200, created_at: daysAgo(10) },
      { patient_name: 'Vikram Bhatia', patient_phone: '9109876543', pickup_location: 'Tri Nagar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'completed', response_time_minutes: 13, amount: 2000, created_at: daysAgo(12) },
      { patient_name: 'Anita Joshi', patient_phone: '9098765432', pickup_location: 'Saraswati Vihar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 25, amount: 2500, created_at: daysAgo(15) },
      { patient_name: 'Sunil Chandra', patient_phone: '9987654321', pickup_location: 'Jahangirpuri, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'cancelled', response_time_minutes: null, amount: 0, created_at: daysAgo(16) },
      // Older rides (last month)
      { patient_name: 'Pooja Nair', patient_phone: '9876512340', pickup_location: 'Mukherjee Nagar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 10, amount: 2500, created_at: daysAgo(35) },
      { patient_name: 'Rajiv Malhotra', patient_phone: '9765412309', pickup_location: 'Shakurpur, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Scheduled', ambulance_id: ambIds[2], ambulance_code: 'UC-DL-001', driver_name: 'Amit Yadav', status: 'completed', response_time_minutes: 20, amount: 1200, created_at: daysAgo(38) },
      { patient_name: 'Nisha Kapoor', patient_phone: '9654312098', pickup_location: 'Punjabi Bagh, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'completed', response_time_minutes: 15, amount: 2000, created_at: daysAgo(40) },
      { patient_name: 'Dinesh Prasad', patient_phone: '9543212087', pickup_location: 'Paschim Vihar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 7, amount: 2500, created_at: daysAgo(42) },
      { patient_name: 'Meera Pillai', patient_phone: '9432112076', pickup_location: 'Rajouri Garden, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'cancelled', response_time_minutes: null, amount: 0, created_at: daysAgo(45) },
      // 2 months ago
      { patient_name: 'Arun Saxena', patient_phone: '9321012065', pickup_location: 'Kirti Nagar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 12, amount: 2500, created_at: daysAgo(65) },
      { patient_name: 'Seema Rao', patient_phone: '9210912054', pickup_location: 'Tilak Nagar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Scheduled', ambulance_id: ambIds[2], ambulance_code: 'UC-DL-001', driver_name: 'Amit Yadav', status: 'completed', response_time_minutes: 18, amount: 1200, created_at: daysAgo(70) },
      { patient_name: 'Harish Patel', patient_phone: '9109812043', pickup_location: 'Janakpuri, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'completed', response_time_minutes: 16, amount: 2000, created_at: daysAgo(75) },
      { patient_name: 'Usha Pandey', patient_phone: '9098712032', pickup_location: 'Uttam Nagar, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Critical', ambulance_id: ambIds[0], ambulance_code: 'AQ-DL-001', driver_name: 'Ravi Kumar', status: 'completed', response_time_minutes: 29, amount: 2500, created_at: daysAgo(80) },
      // Active ride
      { patient_name: 'Mohan Lal', patient_phone: '9987612021', pickup_location: 'Vikaspuri, Delhi', destination: 'Ujala Cygnus Hospital', urgency: 'Urgent', ambulance_id: ambIds[1], ambulance_code: 'AQ-DL-002', driver_name: 'Suresh Singh', status: 'en_route', response_time_minutes: null, amount: 2000, created_at: daysAgo(0) },
    ]

    for (const ride of rides) {
      await db.collection('hospitals').doc(hospitalId).collection('rides').add({
        ...ride, hospital_id: hospitalId,
      })
    }

    // Create invoices (last 2 months paid, this month pending)
    const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1)
    const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const invoiceData = [
      { period_label: lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' }), total_rides: 5, subtotal: 10200, gst: 1836, total: 12036, status: 'paid', created_at: daysAgo(32) },
      { period_label: twoMonthsAgo.toLocaleString('default', { month: 'long', year: 'numeric' }), total_rides: 4, subtotal: 8200, gst: 1476, total: 9676, status: 'paid', created_at: daysAgo(65) },
      { period_label: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), total_rides: 8, subtotal: 17400, gst: 3132, total: 20532, status: 'pending', created_at: daysAgo(1) },
    ]

    for (const inv of invoiceData) {
      const invRef = await db.collection('hospitals').doc(hospitalId).collection('invoices').add({
        ...inv, hospital_id: hospitalId,
      })
      // Add sample invoice items
      await invRef.collection('items').add({ invoice_id: invRef.id, description: 'Critical Emergency Transport', quantity: 3, rate: 2500, amount: 7500 })
      await invRef.collection('items').add({ invoice_id: invRef.id, description: 'Urgent Medical Transport (ALS)', quantity: 2, rate: 2000, amount: 4000 })
      await invRef.collection('items').add({ invoice_id: invRef.id, description: 'Scheduled Patient Transfer', quantity: 2, rate: 1200, amount: 2400 })
    }

    return NextResponse.json({ success: true, message: 'Demo data seeded successfully! Hospital ID: ' + hospitalId })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
