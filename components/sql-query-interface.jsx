"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { executeQuery } from "@/lib/database"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Play, Copy, Download, Database, History, Code, Clock, Loader2 } from "lucide-react"
import { toast } from "react-toastify"

export default function SqlQueryInterface() {
  const [query, setQuery] = useState("SELECT * FROM patients")
  const [results, setResults] = useState([])
  const [columns, setColumns] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])

  // Load query history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("sql_query_history")
    if (savedHistory) {
      setQueryHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Save query to history
  const saveQueryToHistory = (query, success, resultCount = 0) => {
    const historyItem = {
      id: Date.now(),
      query: query.trim(),
      timestamp: new Date().toISOString(),
      success,
      resultCount,
    }

    const newHistory = [historyItem, ...queryHistory.slice(0, 4)] // Keep only last 5 queries
    setQueryHistory(newHistory)
    localStorage.setItem("sql_query_history", JSON.stringify(newHistory))
  }

  const executeUserQuery = async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const { rows, columns } = await executeQuery(query)
      setResults(rows)
      setColumns(columns)

      saveQueryToHistory(query, true, rows.length)

      toast.success(`Query executed successfully! Found ${rows.length} results.`, {
        position: "top-right",
        autoClose: 3000,
      })
    } catch (err) {
      console.error("SQL execution error:", err)
      const errorMessage = err.message || "An error occurred while executing the query."
      setError(errorMessage)
      saveQueryToHistory(query, false)

      toast.error(`Query failed: ${errorMessage}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(query)
      toast.success("Query copied to clipboard! 📋", {
        position: "top-right",
        autoClose: 2000,
      })
    } catch (err) {
      toast.error("Failed to copy query to clipboard", {
        position: "top-right",
        autoClose: 3000,
      })
    }
  }

  const exportResults = () => {
    if (results.length === 0) {
      toast.warning("No results to export", {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    // Create CSV content
    const headers = columns.join(",")
    const rows = results.map((row) =>
      columns.map((col) => (typeof row[col] === "string" ? `"${row[col].replace(/"/g, '""')}"` : row[col])).join(","),
    )
    const csv = [headers, ...rows].join("\n")

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `query_results_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Query results exported successfully! 📊", {
      position: "top-right",
      autoClose: 3000,
    })
  }

  const loadQueryFromHistory = (historyQuery) => {
    setQuery(historyQuery)
    toast.info("Query loaded from history", {
      position: "top-right",
      autoClose: 2000,
    })
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const sampleQueries = [
    {
      name: "Select All Patients",
      query: "SELECT * FROM patients",
      description: "Retrieve all patient records",
    },
    {
      name: "Count Patients by Gender",
      query: "SELECT gender, COUNT(*) as count FROM patients GROUP BY gender",
      description: "Get patient count grouped by gender",
    },
    {
      name: "Patients with Insurance",
      query:
        "SELECT firstName, lastName, insuranceProvider FROM patients WHERE insuranceProvider IS NOT NULL AND insuranceProvider != ''",
      description: "Find patients who have insurance",
    },
    {
      name: "Create New Table",
      query: `CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patientId INTEGER NOT NULL,
  appointmentDate TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'scheduled',
  FOREIGN KEY (patientId) REFERENCES patients(id)
)`,
      description: "Create an appointments table",
    },
  ]

  return (
    <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-[1.01] transition-all duration-300">
      <CardHeader className="pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              SQL Query Interface
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Execute SQL-like queries against the patient database
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="editor" className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Query Editor</span>
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Sample Queries</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <div className="space-y-6">
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full min-h-[200px] p-4 font-mono text-sm border-0 bg-gray-50 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 transition-all duration-300 resize-none"
                  placeholder="Enter SQL query here..."
                />
                <div className="absolute top-3 right-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToClipboard}
                    className="hover:bg-white/80 dark:hover:bg-gray-600/80 transition-all duration-200"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Button
                  onClick={executeUserQuery}
                  disabled={isExecuting || !query.trim()}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  {isExecuting ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Executing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Play className="h-4 w-4" />
                      <span>Execute Query</span>
                    </div>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={exportResults}
                  disabled={results.length === 0}
                  className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeIn">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-red-100 dark:bg-red-900/40 rounded-full">
                      <Database className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800 dark:text-red-300">Query Error</p>
                      <p className="font-mono text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {results.length > 0 ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      Query Results ({results.length} rows)
                    </h3>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0">
                      Success
                    </Badge>
                  </div>
                  <div className="rounded-lg border-0 overflow-hidden shadow-lg bg-white dark:bg-gray-800">
                    <div className="overflow-x-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-700">
                            {columns.map((column) => (
                              <TableHead key={column} className="font-semibold text-gray-700 dark:text-gray-300">
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((row, index) => (
                            <TableRow
                              key={index}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                            >
                              {columns.map((column) => (
                                <TableCell key={column} className="text-gray-700 dark:text-gray-300">
                                  {row[column] !== null && row[column] !== undefined ? (
                                    String(row[column])
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500 italic">null</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                !error &&
                !isExecuting && (
                  <div className="text-center py-12 space-y-4">
                    <Database className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Ready to execute</h3>
                      <p className="text-gray-500 dark:text-gray-500">
                        Enter a query above and click execute to see results
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </TabsContent>

          <TabsContent value="samples">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Sample Queries</h3>
              {sampleQueries.map((sample, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-300 transform hover:scale-[1.02] border-0 shadow-md bg-white dark:bg-gray-800"
                  onClick={() => setQuery(sample.query)}
                >
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-gray-800 dark:text-gray-200">
                        {sample.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        Click to load
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      {sample.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="py-0 pb-4">
                    <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md overflow-x-auto text-xs font-mono text-gray-700 dark:text-gray-300 border">
                      <code>{sample.query}</code>
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Query History</h3>
                <Badge variant="outline" className="text-xs">
                  Last 5 queries
                </Badge>
              </div>

              {queryHistory.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <History className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No query history</h3>
                    <p className="text-gray-500 dark:text-gray-500">Execute some queries to see them here</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {queryHistory.map((item, index) => (
                    <Card
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-300 transform hover:scale-[1.01] border-0 shadow-md bg-white dark:bg-gray-800"
                      onClick={() => loadQueryFromHistory(item.query)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={`${
                                item.success
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              } border-0 text-xs`}
                            >
                              {item.success ? "Success" : "Failed"}
                            </Badge>
                            {item.success && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {item.resultCount} results
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimestamp(item.timestamp)}
                          </div>
                        </div>
                        <pre className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto border">
                          <code>{item.query}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
