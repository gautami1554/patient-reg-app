"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PatientRegistration from "@/components/patient-registration"
import PatientList from "@/components/patient-list"
import SqlQueryInterface from "@/components/sql-query-interface"
import AuthWrapper from "@/components/auth-wrapper"
import { ThemeToggle } from "@/components/theme-toggle"
import { initializeDatabase, getDatabaseStats } from "@/lib/database"
import { Users, Database, FileText, Activity, TrendingUp, Shield, LogOut } from 'lucide-react'
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { Button } from "@/components/ui/button"

export default function PatientManagementApp() {
  const [stats, setStats] = useState({})
  const [isDbReady, setIsDbReady] = useState(false)

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initializeDatabase()
        setIsDbReady(true)
        loadStats()
      } catch (error) {
        console.error("Failed to initialize database:", error)
      }
    }

    setupDatabase()

    // Listen for BroadcastChannel updates for INSTANT stats updates
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("patient_updates")

      const handleStatsUpdate = (event) => {
        console.log("📊 Dashboard received broadcast:", event.data)

        try {
          const { type, patient } = event.data

          if (type === "PATIENT_ADDED" && patient) {
            console.log("📈 Updating stats for new patient")

            setStats((prevStats) => {
              const newTotalPatients = (prevStats.total_patients || 0) + 1
              const hasInsurance = patient.insuranceProvider && patient.insuranceProvider.trim() !== ""
              const newInsuredPatients = (prevStats.insured_patients || 0) + (hasInsurance ? 1 : 0)

              // Calculate new average age
              const currentTotalAge = (prevStats.average_age || 0) * (prevStats.total_patients || 0)
              const newTotalAge = currentTotalAge + (patient.age || 0)
              const newAverageAge = newTotalPatients > 0 ? newTotalAge / newTotalPatients : 0

              const updatedStats = {
                ...prevStats,
                total_patients: newTotalPatients,
                average_age: newAverageAge,
                insured_patients: newInsuredPatients,
              }

              console.log("✅ Stats updated:", updatedStats)
              return updatedStats
            })
          } else if (type === "PATIENT_DELETED" && patient) {
            console.log("📉 Updating stats for deleted patient")

            setStats((prevStats) => {
              const newTotalPatients = Math.max(0, (prevStats.total_patients || 0) - 1)
              const hasInsurance = patient.insuranceProvider && patient.insuranceProvider.trim() !== ""
              const newInsuredPatients = Math.max(0, (prevStats.insured_patients || 0) - (hasInsurance ? 1 : 0))

              // Calculate new average age
              let newAverageAge = 0
              if (newTotalPatients > 0) {
                const currentTotalAge = (prevStats.average_age || 0) * (prevStats.total_patients || 0)
                const newTotalAge = currentTotalAge - (patient.age || 0)
                newAverageAge = newTotalAge / newTotalPatients
              }

              const updatedStats = {
                ...prevStats,
                total_patients: newTotalPatients,
                average_age: newAverageAge,
                insured_patients: newInsuredPatients,
              }

              console.log("✅ Stats updated after deletion:", updatedStats)
              return updatedStats
            })
          }
        } catch (error) {
          console.error("❌ Error updating stats from broadcast:", error)
        }
      }

      channel.addEventListener("message", handleStatsUpdate)

      return () => {
        channel.removeEventListener("message", handleStatsUpdate)
        channel.close()
      }
    }
  }, [])

  const loadStats = async () => {
    try {
      const dbStats = await getDatabaseStats()
      setStats(dbStats)
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("username")
    window.location.reload()
  }

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Initializing Database...</h2>
          <p className="text-gray-600 dark:text-gray-400">Setting up PGlite for patient management</p>
        </div>
      </div>
    )
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all duration-500">
        {/* Header with Theme Toggle and Logout */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 transition-all duration-300"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="container mx-auto p-4 pt-20 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg">
                <Shield className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight pb-1">
             Patient Management System
            </h1>

            <p className="text-l text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Comprehensive healthcare data management with PGlite database, real-time synchronization, and advanced SQL
              querying capabilities
            </p>
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.total_patients || 0}</div>
                <p className="text-xs text-muted-foreground">Registered in system</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Age</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.average_age ? Math.round(stats.average_age) : 0}
                </div>
                <p className="text-xs text-muted-foreground">Years old</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Insured Patients</CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.insured_patients || 0}</div>
                <p className="text-xs text-muted-foreground">Have insurance coverage</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database Status</CardTitle>
                <Database className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 border-0">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">PGlite ready</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg">
              <TabsTrigger value="register" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Register Patient</span>
              </TabsTrigger>
              <TabsTrigger value="patients" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Patient Records</span>
              </TabsTrigger>
              <TabsTrigger value="query" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>SQL Interface</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="space-y-6">
              <PatientRegistration />
            </TabsContent>

            <TabsContent value="patients" className="space-y-6">
              <PatientList />
            </TabsContent>

            <TabsContent value="query" className="space-y-6">
              <SqlQueryInterface />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              Built with Next.js, PGlite, and Shadcn/ui 
            </p>
          </div>
        </div>

        {/* Toast Container */}
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable={false}
          pauseOnHover={false}
          theme="colored"
          className="text-sm"
        />
      </div>
    </AuthWrapper>
  )
}