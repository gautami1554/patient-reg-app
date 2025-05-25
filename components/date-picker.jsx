"use client"

import { useState } from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export function DatePicker({ date, setDate }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(date || new Date())
  const [view, setView] = useState("calendar") // "calendar", "month", "year"

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i) // Last 100 years
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const handleYearSelect = (year) => {
    const newDate = new Date(viewDate)
    newDate.setFullYear(Number.parseInt(year))
    setViewDate(newDate)
    setView("month")
  }

  const handleMonthSelect = (monthIndex) => {
    const newDate = new Date(viewDate)
    newDate.setMonth(monthIndex)
    setViewDate(newDate)
    setView("calendar")
  }

  const handleDateSelect = (selectedDate) => {
    setDate(selectedDate)
    setOpen(false)
    setView("calendar")
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const formatDate = (date) => {
    if (!date) return "Pick a date"
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isToday = (date) => {
    const today = new Date()
    return (
      date &&
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (checkDate) => {
    return (
      date &&
      checkDate &&
      date.getDate() === checkDate.getDate() &&
      date.getMonth() === checkDate.getMonth() &&
      date.getFullYear() === checkDate.getFullYear()
    )
  }

  const isFutureDate = (checkDate) => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return checkDate > today
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-11 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300",
            !date && "text-muted-foreground",
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDate(date)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newDate = new Date(viewDate)
                if (view === "calendar") {
                  newDate.setMonth(newDate.getMonth() - 1)
                } else if (view === "month") {
                  newDate.setFullYear(newDate.getFullYear() - 1)
                } else if (view === "year") {
                  newDate.setFullYear(newDate.getFullYear() - 10)
                }
                setViewDate(newDate)
              }}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center space-x-1">
              {view === "calendar" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("month")}
                    className="font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {months[viewDate.getMonth()]}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("year")}
                    className="font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {viewDate.getFullYear()}
                  </Button>
                </>
              )}
              {view === "month" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("year")}
                  className="font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  {viewDate.getFullYear()}
                </Button>
              )}
              {view === "year" && <span className="font-semibold text-gray-900 dark:text-gray-100">Select Year</span>}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newDate = new Date(viewDate)
                if (view === "calendar") {
                  newDate.setMonth(newDate.getMonth() + 1)
                } else if (view === "month") {
                  newDate.setFullYear(newDate.getFullYear() + 1)
                } else if (view === "year") {
                  newDate.setFullYear(newDate.getFullYear() + 10)
                }
                setViewDate(newDate)
              }}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-3">
            {view === "calendar" && (
              <div className="space-y-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(viewDate).map((day, index) => (
                    <div key={index} className="aspect-square">
                      {day ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDateSelect(day)}
                          disabled={isFutureDate(day)}
                          className={cn(
                            "h-8 w-8 p-0 font-normal transition-all duration-200",
                            isSelected(day) && "bg-blue-600 text-white hover:bg-blue-700",
                            isToday(day) &&
                              !isSelected(day) &&
                              "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
                            isFutureDate(day) && "text-gray-300 dark:text-gray-600 cursor-not-allowed",
                            !isSelected(day) &&
                              !isToday(day) &&
                              !isFutureDate(day) &&
                              "hover:bg-gray-100 dark:hover:bg-gray-700",
                          )}
                        >
                          {day.getDate()}
                        </Button>
                      ) : (
                        <div className="h-8 w-8" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === "month" && (
              <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => (
                  <Button
                    key={month}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      "h-10 font-normal transition-all duration-200",
                      viewDate.getMonth() === index && "bg-blue-600 text-white hover:bg-blue-700",
                      viewDate.getMonth() !== index && "hover:bg-gray-100 dark:hover:bg-gray-700",
                    )}
                  >
                    {month.slice(0, 3)}
                  </Button>
                ))}
              </div>
            )}

            {view === "year" && (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {years.map((year) => (
                  <Button
                    key={year}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleYearSelect(year)}
                    className={cn(
                      "h-10 font-normal transition-all duration-200",
                      viewDate.getFullYear() === year && "bg-blue-600 text-white hover:bg-blue-700",
                      viewDate.getFullYear() !== year && "hover:bg-gray-100 dark:hover:bg-gray-700",
                    )}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDate(new Date())
                  setOpen(false)
                  setView("calendar")
                }}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setView("calendar")
                }}
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
