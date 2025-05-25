export interface Patient {
  id: number
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  email: string
  phone: string
  address: string
  medicalHistory?: string
  insuranceProvider?: string
  insuranceNumber?: string
  createdAt?: string
}
