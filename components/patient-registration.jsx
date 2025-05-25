"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { addPatient } from "@/lib/database"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { DatePicker } from "@/components/date-picker"
import { User, Mail, Phone, MapPin, Shield, FileText, Loader2, UserCheck, AlertTriangle, Calendar } from "lucide-react"
import { toast } from "react-toastify"

const patientSchema = z.object({
  firstName: z
    .string()
    .min(2, { message: "First name must be at least 2 characters." })
    .max(50, { message: "First name must be less than 50 characters." })
    .regex(/^[a-zA-Z\s]+$/, { message: "First name can only contain letters and spaces." }),
  lastName: z
    .string()
    .min(2, { message: "Last name must be at least 2 characters." })
    .max(50, { message: "Last name must be less than 50 characters." })
    .regex(/^[a-zA-Z\s]+$/, { message: "Last name can only contain letters and spaces." }),
  dateOfBirth: z
    .date({ required_error: "Date of birth is required." })
    .refine(
      (date) => {
        const today = new Date()
        today.setHours(23, 59, 59, 999) // Set to end of today
        return date < today
      },
      { message: "Date of birth must be before today." },
    )
    .refine(
      (date) => {
        const today = new Date()
        const age = today.getFullYear() - date.getFullYear()
        const monthDiff = today.getMonth() - date.getMonth()
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate()) ? age - 1 : age
        return actualAge >= 0 && actualAge <= 150
      },
      { message: "Please enter a valid date of birth (age must be between 0-150 years)." },
    ),
  age: z
    .string()
    .min(1, { message: "Age is required." })
    .regex(/^\d+$/, { message: "Age must be a number." })
    .refine(
      (val) => {
        const age = Number.parseInt(val)
        return age >= 0 && age <= 150
      },
      { message: "Age must be between 0 and 150." },
    ),
  gender: z.string().min(1, { message: "Please select a gender." }),
  email: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .max(100, { message: "Email must be less than 100 characters." }),
  countryCode: z.string().min(1, { message: "Please select a country code." }),
  mobileNumber: z
    .string()
    .min(10, { message: "Mobile number must be exactly 10 digits." })
    .max(10, { message: "Mobile number must be exactly 10 digits." })
    .regex(/^\d{10}$/, { message: "Mobile number must contain exactly 10 digits only." }),
  address: z
    .string()
    .min(5, { message: "Address must be at least 5 characters." })
    .max(200, { message: "Address must be less than 200 characters." }),
  emergencyContactName: z
    .string()
    .max(100, { message: "Emergency contact name must be less than 100 characters." })
    .optional(),
  emergencyContactPhone: z
    .string()
    .max(20, { message: "Emergency contact phone must be less than 20 characters." })
    .regex(/^[\d\s\-+()]*$/, { message: "Please enter a valid phone number." })
    .optional(),
  medicalHistory: z.string().max(1000, { message: "Medical history must be less than 1000 characters." }).optional(),
  allergies: z.string().max(500, { message: "Allergies must be less than 500 characters." }).optional(),
  currentMedications: z
    .string()
    .max(500, { message: "Current medications must be less than 500 characters." })
    .optional(),
  insuranceProvider: z
    .string()
    .max(100, { message: "Insurance provider must be less than 100 characters." })
    .optional(),
  insurancePolicyNumber: z
    .string()
    .max(50, { message: "Insurance policy number must be less than 50 characters." })
    .optional(),
})

// Common country codes
const countryCodes = [
  { code: "+1", country: "US/Canada", flag: "🇺🇸" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
]

// Global broadcast channel manager (same as in patient-list)
let globalChannel = null

function getBroadcastChannel() {
  if (!("BroadcastChannel" in window)) {
    console.warn("⚠️ BroadcastChannel not supported")
    return null
  }

  if (!globalChannel || globalChannel.readyState === "closed") {
    try {
      globalChannel = new BroadcastChannel("patient_updates")
      console.log("🔄 Created new global broadcast channel")
    } catch (error) {
      console.error("Failed to create broadcast channel:", error)
      return null
    }
  }

  return globalChannel
}

function sendBroadcastMessage(message) {
  const channel = getBroadcastChannel()
  if (channel) {
    try {
      channel.postMessage(message)
      console.log("📤 Broadcast message sent:", message.type)
      return true
    } catch (error) {
      console.error("Failed to send broadcast message:", error)
      return false
    }
  }
  return false
}

export default function PatientRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const form = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      age: "",
      countryCode: "+91", // Default to India
      mobileNumber: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalHistory: "",
      allergies: "",
      currentMedications: "",
      insuranceProvider: "",
      insurancePolicyNumber: "",
    },
  })

  // Initialize broadcast channel on mount
  useEffect(() => {
    console.log("🔄 Setting up patient registration broadcast...")

    // Initialize the global channel
    getBroadcastChannel()

    // Send ready signal after a short delay
    setTimeout(() => {
      sendBroadcastMessage({
        type: "TAB_READY",
        source: "patient-registration",
        timestamp: Date.now(),
      })
    }, 100)
  }, [])

  // Auto-calculate age when date of birth changes
  const watchDateOfBirth = form.watch("dateOfBirth")
  useEffect(() => {
    if (watchDateOfBirth) {
      const today = new Date()
      const birthDate = new Date(watchDateOfBirth)
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      if (age >= 0 && age <= 150) {
        form.setValue("age", age.toString())
      }
    }
  }, [watchDateOfBirth, form])

  // Restore form data from localStorage on component mount
  useEffect(() => {
    const savedFormData = localStorage.getItem("patient_form_data")
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData)
        // Restore all form fields
        Object.keys(parsedData).forEach((key) => {
          if (key === "dateOfBirth" && parsedData[key]) {
            form.setValue(key, new Date(parsedData[key]))
          } else if (parsedData[key]) {
            form.setValue(key, parsedData[key])
          }
        })
        setHasUnsavedChanges(true)
      } catch (error) {
        console.error("Error restoring form data:", error)
      }
    }
  }, [form])

  // Save form data to localStorage on every change
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Only save if there's actual data
      const hasData = Object.values(value).some((val) => val && val !== "")
      if (hasData) {
        localStorage.setItem("patient_form_data", JSON.stringify(value))
        setHasUnsavedChanges(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      // Combine country code and mobile number for storage
      const phoneNumber = `${data.countryCode}${data.mobileNumber}`

      const patientData = {
        ...data,
        phone: phoneNumber,
      }

      const result = await addPatient(patientData)
      const patientName = `${data.firstName} ${data.lastName}`

      console.log("✅ Patient added to database:", { patientName, result })

      // Create complete patient object
      const completePatientData = {
        id: result.id,
        patientId: result.patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: phoneNumber,
        age: Number.parseInt(data.age),
        gender: data.gender,
        dateOfBirth: data.dateOfBirth.toISOString(),
        address: data.address,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        medicalHistory: data.medicalHistory || null,
        allergies: data.allergies || null,
        currentMedications: data.currentMedications || null,
        insuranceProvider: data.insuranceProvider || null,
        insurancePolicyNumber: data.insurancePolicyNumber || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Send broadcast message with retry mechanism
      const message = {
        type: "ADD_PATIENT",
        patient: completePatientData,
        timestamp: Date.now(),
      }

      console.log("📤 SENDING BROADCAST:", message)

      // Send immediately
      sendBroadcastMessage(message)

      // Retry after delays to ensure delivery
      setTimeout(() => sendBroadcastMessage(message), 100)
      setTimeout(() => sendBroadcastMessage(message), 300)
      setTimeout(() => sendBroadcastMessage(message), 500)

      console.log("✅ BROADCAST SENT SUCCESSFULLY")

      // Clear saved form data
      localStorage.removeItem("patient_form_data")
      setHasUnsavedChanges(false)

      // Show success message after a small delay to avoid render conflicts
      setTimeout(() => {
        toast.success(`${patientName} registered successfully!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
          className: "text-sm",
        })
      }, 0)

      form.reset()
    } catch (error) {
      console.error("❌ Error registering patient:", error)

      // Show error message after a small delay to avoid render conflicts
      setTimeout(() => {
        toast.error("Registration failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
          className: "text-sm",
        })
      }, 0)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-[1.01] transition-all duration-300">
      <CardHeader className="pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              Register New Patient
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">First Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          {...field}
                          className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium">Date of Birth *</FormLabel>
                      <DatePicker date={field.value} setDate={field.onChange} />
                      <FormDescription className="text-xs">Age will be calculated automatically</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Age *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder=""
                            {...field}
                            type="number"
                            min="0"
                            max="150"
                            className="pl-10 h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">Auto-filled from date of birth</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Gender *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <Mail className="h-5 w-5 mr-2 text-blue-600" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Email *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="john.doe@example.com"
                            {...field}
                            className="pl-10 h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium">Mobile Number *</FormLabel>
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300">
                                <SelectValue placeholder="Code" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countryCodes.map((country) => (
                                <SelectItem key={country.code} value={country.code}>
                                  <div className="flex items-center space-x-2">
                                    <span>{country.flag}</span>
                                    <span>{country.code}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mobileNumber"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                {...field}
                                maxLength={10}
                                className="pl-10 h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                                onChange={(e) => {
                                  // Only allow digits
                                  const value = e.target.value.replace(/\D/g, "")
                                  field.onChange(value)
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription className="text-xs">
                    Enter 10-digit mobile number without country code
                  </FormDescription>
                </div>
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Address *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Textarea
                          placeholder="123 Main St, City, State, ZIP"
                          {...field}
                          className="pl-10 min-h-[80px] border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300 resize-none"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Emergency Contact Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <UserCheck className="h-5 w-5 mr-2 text-blue-600" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Jane Doe"
                          {...field}
                          className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="+91"
                            {...field}
                            className="pl-10 h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">Optional (include country code)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Insurance Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                Insurance Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="insuranceProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Insurance Provider</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Insurance Company"
                          {...field}
                          className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insurancePolicyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Insurance Policy Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Policy Number"
                          {...field}
                          className="h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Medical Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Medical Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="medicalHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Medical History</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Previous surgeries, chronic conditions, etc."
                          className="min-h-[100px] border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 text-orange-500" />
                        Allergies
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Food allergies, drug allergies, environmental allergies, etc."
                          className="min-h-[100px] border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="currentMedications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Current Medications</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="List current medications, dosages, and frequency"
                        className="min-h-[80px] border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registering Patient...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Register Patient</span>
                  </div>
                )}
              </Button>

              {hasUnsavedChanges && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset()
                    localStorage.removeItem("patient_form_data")
                    setHasUnsavedChanges(false)
                  }}
                  className="h-12 px-3 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
