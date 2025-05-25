"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getAllPatients, deletePatient } from "@/lib/database"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Download,
  Search,
  Trash2,
  Users,
  Filter,
  Calendar,
  Mail,
  Phone,
  Loader2,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  BadgeIcon as IdCard,
} from "lucide-react"
import { toast } from "react-toastify"

export default function PatientList() {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterGender, setFilterGender] = useState("all")

  const loadPatients = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true)

      const data = await getAllPatients()
      setPatients(data)
    } catch (error) {
      console.error("Error loading patients:", error)
      toast.error("Failed to load patient records", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })
    } finally {
      setIsLoading(false)
      if (showRefreshIndicator) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients()

    // Enhanced BroadcastChannel for INSTANT cross-tab sync
    const channel = new BroadcastChannel("patient_updates")

    const handleMessage = (event) => {
      console.log("PatientList: Received broadcast message:", event.data)

      try {
        const { type, data, source, timestamp } = event.data

        // Ignore messages from the same tab if needed
        if (source === "patient_list") {
          console.log("Ignoring message from same component type")
          return
        }

        if (type === "PATIENT_ADDED" && data?.patientData) {
          console.log("Processing PATIENT_ADDED message")

          // Add new patient to the list instantly
          setPatients((prevPatients) => {
            // Check if patient already exists to avoid duplicates
            const exists = prevPatients.some(
              (p) => p.id === data.patientData.id || p.patientId === data.patientData.patientId,
            )

            if (exists) {
              console.log("Patient already exists, skipping duplicate")
              return prevPatients
            }

            console.log("✅ Adding new patient to list:", data.patientData.firstName, data.patientData.lastName)
            return [data.patientData, ...prevPatients]
          })

          // Show toast notification for cross-tab updates
          if (data.patientName) {
            toast.info(`${data.patientName} was registered in another tab`, {
              position: "top-right",
              autoClose: 2000,
              hideProgressBar: true,
              closeOnClick: true,
              pauseOnHover: false,
              draggable: false,
              className: "text-sm",
            })
          }
        } else if (type === "PATIENT_DELETED" && data?.patientId) {
          console.log("Processing PATIENT_DELETED message")

          // Remove patient from the list instantly
          setPatients((prevPatients) => {
            const filtered = prevPatients.filter(
              (patient) => patient.id !== data.patientId && patient.patientId !== data.patientId,
            )

            console.log("✅ Patient deleted from list from broadcast", {
              before: prevPatients.length,
              after: filtered.length,
              deletedId: data.patientId,
            })

            // Show toast notification for cross-tab updates
            if (data.patientName && filtered.length !== prevPatients.length) {
              toast.info(`${data.patientName} was deleted in another tab`, {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: true,
                closeOnClick: true,
                pauseOnHover: false,
                draggable: false,
                className: "text-sm",
              })
            }

            return filtered
          })
        } else {
          console.log("Unknown message type or missing data:", type)
        }
      } catch (error) {
        console.error("Error handling broadcast message:", error)
      }
    }

    channel.addEventListener("message", handleMessage)

    // Cleanup function
    return () => {
      channel.removeEventListener("message", handleMessage)
      channel.close()
    }
  }, [])

  const handleDeletePatient = async (id, patientName) => {
    try {
      await deletePatient(id)

      // Broadcast to other tabs with enhanced data
      const broadcastChannel = new BroadcastChannel("patient_updates")
      const message = {
        type: "PATIENT_DELETED",
        data: {
          patientName,
          patientId: id, // This should be the database ID
        },
        timestamp: Date.now(),
        source: "patient_list",
      }

      try {
        broadcastChannel.postMessage(message)
        console.log("✅ Delete broadcast sent successfully")

        // Add delay before closing
        setTimeout(() => {
          broadcastChannel.close()
        }, 100)
      } catch (broadcastError) {
        console.error("❌ Delete broadcast failed:", broadcastError)
      }

      toast.success(`${patientName} deleted successfully`, {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })

      // Remove from current tab instantly
      setPatients((prevPatients) => prevPatients.filter((patient) => patient.id !== id))
    } catch (error) {
      console.error("❌ Error deleting patient:", error)
      toast.error("Failed to delete patient", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })
    }
  }

  const exportToCSV = () => {
    if (patients.length === 0) {
      toast.warning("No patient data to export", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })
      return
    }

    // Create CSV content
    const headers = Object.keys(patients[0]).join(",")
    const rows = patients.map((patient) =>
      Object.values(patient)
        .map((value) => (typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value))
        .join(","),
    )
    const csv = [headers, ...rows].join("\n")

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `patients_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Data exported successfully", {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
      className: "text-sm",
    })
  }

  const filteredPatients = patients.filter((patient) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      patient.firstName.toLowerCase().includes(searchLower) ||
      patient.lastName.toLowerCase().includes(searchLower) ||
      patient.email.toLowerCase().includes(searchLower) ||
      patient.phone.includes(searchTerm) ||
      (patient.patientId && patient.patientId.toLowerCase().includes(searchLower))
    const matchesGender = filterGender === "all" || patient.gender === filterGender
    return matchesSearch && matchesGender
  })

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getGenderBadgeColor = (gender) => {
    switch (gender) {
      case "male":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "female":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300"
      case "other":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  return (
    <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-[1.01] transition-all duration-300">
      <CardHeader className="pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg">
              <Users className="h-6 w-6 text-white" />
              {isRefreshing && <RefreshCw className="h-3 w-3 animate-spin text-white absolute -mt-1 -ml-1" />}
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                Patient Records
                {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                View and manage all registered patients ({patients.length} total)
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadPatients(true)}
              disabled={isRefreshing}
              className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 transition-all duration-300"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={patients.length === 0}
              className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 transition-all duration-300"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, or patient ID..."
              className="pl-10 h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="pl-10 pr-8 h-11 border-0 bg-gray-50 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 transition-all duration-300 appearance-none cursor-pointer"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-gray-600 dark:text-gray-400">Loading patient records...</p>
            </div>
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Users className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No patients registered yet</h3>
              <p className="text-gray-500 dark:text-gray-500">Start by registering your first patient</p>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Search className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No patients found</h3>
              <p className="text-gray-500 dark:text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-0 overflow-hidden shadow-lg bg-white dark:bg-gray-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      <div className="flex items-center">
                        <IdCard className="h-4 w-4 mr-1" />
                        Patient ID
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Patient</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Age / DOB
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Gender</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Contact</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Emergency Contact</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Medical Info</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient, index) => (
                    <TableRow
                      key={patient.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200 animate-fadeIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell className="font-medium">
                        <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 border-0 font-mono text-xs">
                          {patient.patientId ||
                            `PAT-${new Date().getFullYear()}-${String(patient.id).padStart(4, "0")}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {patient.firstName.charAt(0)}
                            {patient.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {patient.firstName} {patient.lastName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0 text-xs">
                            {patient.age} years
                          </Badge>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(patient.dateOfBirth)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0 font-medium ${getGenderBadgeColor(patient.gender)}`}
                        >
                          {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                            <Mail className="h-3 w-3 mr-2 text-gray-400" />
                            <span className="truncate max-w-[150px]" title={patient.email}>
                              {patient.email}
                            </span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Phone className="h-3 w-3 mr-2 text-gray-400" />
                            {patient.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.emergencyContactName ? (
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                              <UserCheck className="h-3 w-3 mr-2 text-gray-400" />
                              <span className="truncate max-w-[100px]" title={patient.emergencyContactName}>
                                {patient.emergencyContactName}
                              </span>
                            </div>
                            {patient.emergencyContactPhone && (
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Phone className="h-3 w-3 mr-2 text-gray-400" />
                                {patient.emergencyContactPhone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {patient.allergies && (
                            <div className="flex items-center text-sm text-orange-600 dark:text-orange-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              <span className="truncate max-w-[100px]" title={patient.allergies}>
                                {patient.allergies}
                              </span>
                            </div>
                          )}
                          {patient.medicalHistory && (
                            <div
                              className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[100px]"
                              title={patient.medicalHistory}
                            >
                              {patient.medicalHistory}
                            </div>
                          )}
                          {!patient.allergies && !patient.medicalHistory && (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-gray-800 border-0 shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                                Delete Patient Record
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                                Are you sure you want to delete{" "}
                                <strong>
                                  {patient.firstName} {patient.lastName}
                                </strong>
                                's record (
                                {patient.patientId ||
                                  `PAT-${new Date().getFullYear()}-${String(patient.id).padStart(4, "0")}`}
                                )? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-0 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleDeletePatient(patient.id, `${patient.firstName} ${patient.lastName}`)
                                }
                                className="bg-red-500 hover:bg-red-600 text-white border-0"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
