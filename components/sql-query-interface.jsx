"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { executeQuery } from "@/lib/database"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Play, Copy, Download, Database, History, Code, Clock, Loader2, RefreshCw, Search, Filter } from "lucide-react"
import { toast } from "react-toastify"
import { Input } from "@/components/ui/input"
import Editor from "@monaco-editor/react"

export default function SqlQueryInterface() {
  const [query, setQuery] = useState("SELECT * FROM patients")
  const [results, setResults] = useState([])
  const [columns, setColumns] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState("asc")
  const editorRef = useRef(null)

  // Load query history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("sql_query_history")
    if (savedHistory) {
      setQueryHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Subscribe to patient changes for auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const channel = new BroadcastChannel("patient_updates")

    const handleMessage = (event) => {
      console.log("SqlQueryInterface: Received patient change:", event.data)

      // Auto-refresh if we have results and auto-refresh is enabled
      if (results.length > 0 && query.trim()) {
        executeUserQuery(true) // true = auto-refresh
      }
    }

    channel.addEventListener("message", handleMessage)

    return () => {
      channel.removeEventListener("message", handleMessage)
      channel.close()
    }
  }, [query, results, autoRefresh])

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

  const executeUserQuery = async (isAutoRefresh = false) => {
    setIsExecuting(true)
    setError(null)

    if (isAutoRefresh) setIsRefreshing(true)

    try {
      const { rows, columns } = await executeQuery(query)
      setResults(rows)
      setColumns(columns)
      setSortColumn(null)
      setSortDirection("asc")

      saveQueryToHistory(query, true, rows.length)

      if (isAutoRefresh) {
        // No notification for auto-refresh
      } else {
        toast.success(`Query executed successfully! Found ${rows.length} results.`, {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
          className: "text-sm",
        })
      }
    } catch (err) {
      console.error("SQL execution error:", err)
      const errorMessage = err.message || "An error occurred while executing the query."
      setError(errorMessage)
      saveQueryToHistory(query, false)

      if (!isAutoRefresh) {
        toast.error(`Query failed: ${errorMessage}`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
          className: "text-sm",
        })
      }
    } finally {
      setIsExecuting(false)
      if (isAutoRefresh) setIsRefreshing(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(query)
      toast.success("Query copied to clipboard", {
        position: "top-right",
        autoClose: 1500,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })
    } catch (err) {
      toast.error("Failed to copy query", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        className: "text-sm",
      })
    }
  }

  const exportResults = () => {
    if (filteredAndSortedResults.length === 0) {
      toast.warning("No results to export", {
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
    const headers = columns.join(",")
    const rows = filteredAndSortedResults.map((row) =>
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

    toast.success("Results exported successfully", {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
      className: "text-sm",
    })
  }

  const loadQueryFromHistory = (historyQuery) => {
    setQuery(historyQuery)
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

  // Enhanced sorting function
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Filter and sort results
  const filteredAndSortedResults = results
    .filter((row) => {
      if (!searchTerm) return true
      return columns.some((col) => {
        const value = row[col]
        return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      })
    })
    .sort((a, b) => {
      if (!sortColumn) return 0

      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === "asc" ? 1 : -1
      if (bVal == null) return sortDirection === "asc" ? -1 : 1

      // Convert to strings for comparison
      const aStr = aVal.toString().toLowerCase()
      const bStr = bVal.toString().toLowerCase()

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1
      return 0
    })

  // Monaco Editor configuration with updated suggestions for new fields
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor

    // Configure SQL language features
    monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          // SQL Keywords
          {
            label: "SELECT",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "SELECT ",
            documentation: "Retrieve data from database tables",
          },
          {
            label: "FROM",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "FROM ",
            documentation: "Specify the table to query",
          },
          {
            label: "WHERE",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "WHERE ",
            documentation: "Filter rows based on conditions",
          },
          {
            label: "ORDER BY",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "ORDER BY ",
            documentation: "Sort the result set",
          },
          {
            label: "GROUP BY",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "GROUP BY ",
            documentation: "Group rows that have the same values",
          },
          {
            label: "HAVING",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "HAVING ",
            documentation: "Filter groups based on conditions",
          },
          {
            label: "INSERT INTO",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "INSERT INTO ",
            documentation: "Insert new rows into a table",
          },
          {
            label: "UPDATE",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "UPDATE ",
            documentation: "Modify existing rows in a table",
          },
          {
            label: "DELETE FROM",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "DELETE FROM ",
            documentation: "Remove rows from a table",
          },
          {
            label: "CREATE TABLE",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "CREATE TABLE ",
            documentation: "Create a new table",
          },
          // Table names
          {
            label: "patients",
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: "patients",
            documentation: "Main patients table",
          },
          // Updated column names for patients table - REMOVED id, added patient_id first
          {
            label: "patient_id",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "patient_id",
            documentation: "Patient ID (PAT-YYYY-NNNN format)",
          },
          {
            label: "first_name",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "first_name",
            documentation: "Patient's first name",
          },
          {
            label: "last_name",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "last_name",
            documentation: "Patient's last name",
          },
          {
            label: "email",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "email",
            documentation: "Patient's email address",
          },
          {
            label: "phone",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "phone",
            documentation: "Patient's phone number with country code",
          },
          {
            label: "date_of_birth",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "date_of_birth",
            documentation: "Patient's date of birth",
          },
          {
            label: "age",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "age",
            documentation: "Patient's age in years",
          },
          {
            label: "gender",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "gender",
            documentation: "Patient's gender",
          },
          {
            label: "address",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "address",
            documentation: "Patient's address",
          },
          {
            label: "emergency_contact_name",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "emergency_contact_name",
            documentation: "Emergency contact name",
          },
          {
            label: "emergency_contact_phone",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "emergency_contact_phone",
            documentation: "Emergency contact phone number",
          },
          {
            label: "medical_history",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "medical_history",
            documentation: "Patient's medical history",
          },
          {
            label: "allergies",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "allergies",
            documentation: "Patient's allergies",
          },
          {
            label: "current_medications",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "current_medications",
            documentation: "Patient's current medications",
          },
          {
            label: "insurance_provider",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "insurance_provider",
            documentation: "Patient's insurance provider",
          },
          {
            label: "insurance_policy_number",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "insurance_policy_number",
            documentation: "Patient's insurance policy number",
          },
          {
            label: "created_at",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "created_at",
            documentation: "Record creation timestamp",
          },
          {
            label: "updated_at",
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: "updated_at",
            documentation: "Record last update timestamp",
          },
          // SQL Functions
          {
            label: "COUNT(*)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "COUNT(*)",
            documentation: "Count the number of rows",
          },
          {
            label: "COUNT(column)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "COUNT(${1:column})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Count non-null values in a column",
          },
          {
            label: "MAX(column)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "MAX(${1:column})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Find the maximum value",
          },
          {
            label: "MIN(column)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "MIN(${1:column})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Find the minimum value",
          },
          {
            label: "AVG(column)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "AVG(${1:column})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Calculate the average value",
          },
          {
            label: "SUM(column)",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "SUM(${1:column})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Calculate the sum of values",
          },
        ]

        return { suggestions }
      },
    })

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeUserQuery()
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      copyToClipboard()
    })
  }

  // Updated sample queries with patient_id field and without internal id
  const sampleQueries = [
    {
      name: "Select All Patients",
      query: "SELECT patient_id, first_name, last_name, age, gender FROM patients",
      description: "Retrieve all patient records with key information",
    },
    {
      name: "Count Patients by Gender",
      query: "SELECT gender, COUNT(*) as count FROM patients GROUP BY gender",
      description: "Get patient count grouped by gender",
    },
    {
      name: "Patients with Insurance",
      query:
        "SELECT patient_id, first_name, last_name, age, insurance_provider FROM patients WHERE insurance_provider IS NOT NULL AND insurance_provider != ''",
      description: "Find patients who have insurance",
    },
    {
      name: "Patients by Age Group",
      query:
        "SELECT CASE WHEN age < 18 THEN 'Minor' WHEN age < 65 THEN 'Adult' ELSE 'Senior' END as age_group, COUNT(*) as count FROM patients GROUP BY age_group",
      description: "Group patients by age categories",
    },
    {
      name: "Patients with Allergies",
      query:
        "SELECT patient_id, first_name, last_name, age, allergies FROM patients WHERE allergies IS NOT NULL AND allergies != ''",
      description: "Find patients with known allergies",
    },
    {
      name: "Recent Patients",
      query:
        "SELECT patient_id, first_name, last_name, age, email, created_at FROM patients ORDER BY created_at DESC LIMIT 10",
      description: "Get the 10 most recently registered patients",
    },
    {
      name: "Senior Patients",
      query: "SELECT patient_id, first_name, last_name, age, medical_history FROM patients WHERE age >= 65",
      description: "Get patients aged 65 and above with medical information",
    },
  ]

  return (
    <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transform hover:scale-[1.01] transition-all duration-300">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg">
              <Database className="h-6 w-6 text-white" />
              {isRefreshing && <RefreshCw className="h-3 w-3 animate-spin text-white absolute -mt-1 -ml-1" />}
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                SQL Query Interface
                {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Execute SQL queries with intelligent autocompletion and enhanced results
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`${autoRefresh ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50"} transition-all duration-300`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "text-green-600" : ""}`} />
            Auto-refresh: {autoRefresh ? "ON" : "OFF"}
          </Button>
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
                <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700">
                  <Editor
                    height="200px"
                    defaultLanguage="sql"
                    value={query}
                    onChange={(value) => setQuery(value || "")}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: "on",
                      suggest: {
                        showKeywords: true,
                        showSnippets: true,
                        showFunctions: true,
                      },
                      quickSuggestions: {
                        other: true,
                        comments: false,
                        strings: false,
                      },
                      suggestOnTriggerCharacters: true,
                      acceptSuggestionOnEnter: "on",
                      tabCompletion: "on",
                    }}
                  />
                </div>
                <div className="absolute top-3 right-3 z-10">
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
                  onClick={() => executeUserQuery()}
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
                      <span>Execute Query (Ctrl+Enter)</span>
                    </div>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={exportResults}
                  disabled={filteredAndSortedResults.length === 0}
                  className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <strong>💡 Tips:</strong> Press{" "}
                <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">Ctrl+Enter</kbd> to execute •
                <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded ml-1">Ctrl+Space</kbd> for suggestions
                •<kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded ml-1">Ctrl+S</kbd> to copy query
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Query Results ({filteredAndSortedResults.length} of {results.length} rows)
                      </h3>
                      {autoRefresh && (
                        <Badge variant="outline" className="text-xs">
                          Auto-refreshing
                        </Badge>
                      )}
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0">
                        Success
                      </Badge>
                    </div>

                    {/* Enhanced Search and Filter Controls */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search results..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-9 w-48 border-0 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 transition-all duration-300"
                        />
                      </div>
                      {searchTerm && (
                        <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")} className="h-9 px-2">
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Results Table with Full Content Visibility */}
                  <div className="rounded-lg border-0 overflow-hidden shadow-lg bg-white dark:bg-gray-800">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
                            {columns.map((column) => (
                              <TableHead
                                key={column}
                                className="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 transition-colors duration-200 min-w-[150px]"
                                onClick={() => handleSort(column)}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>{column}</span>
                                  {sortColumn === column && (
                                    <span className="text-purple-600 dark:text-purple-400">
                                      {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                  )}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndSortedResults.map((row, index) => (
                            <TableRow
                              key={index}
                              className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-indigo-50/50 dark:hover:from-purple-900/10 dark:hover:to-indigo-900/10 transition-all duration-200"
                            >
                              {columns.map((column) => (
                                <TableCell key={column} className="text-gray-700 dark:text-gray-300 py-3 min-w-[150px]">
                                  {row[column] !== null && row[column] !== undefined ? (
                                    <div className="break-words whitespace-normal" title={String(row[column])}>
                                      {/* Special formatting for different data types */}
                                      {column === "patient_id" ? (
                                        <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 border-0 font-mono text-xs">
                                          {String(row[column])}
                                        </Badge>
                                      ) : column === "age" ? (
                                        <Badge variant="outline" className="text-xs">
                                          {row[column]} years
                                        </Badge>
                                      ) : column === "email" ? (
                                        <span className="text-blue-600 dark:text-blue-400 font-mono text-sm break-all">
                                          {String(row[column])}
                                        </span>
                                      ) : column === "phone" ? (
                                        <span className="text-green-600 dark:text-green-400 font-mono text-sm">
                                          {String(row[column])}
                                        </span>
                                      ) : column === "gender" ? (
                                        <Badge
                                          className={`text-xs ${
                                            row[column] === "male"
                                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                              : row[column] === "female"
                                                ? "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300"
                                                : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                                          } border-0`}
                                        >
                                          {String(row[column]).charAt(0).toUpperCase() + String(row[column]).slice(1)}
                                        </Badge>
                                      ) : column.includes("date") ? (
                                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                                          {new Date(row[column]).toLocaleDateString()}
                                        </span>
                                      ) : column === "address" ||
                                        column === "medical_history" ||
                                        column === "allergies" ? (
                                        // Full content display for long text fields
                                        <div className="max-w-xs break-words whitespace-normal text-sm">
                                          {String(row[column])}
                                        </div>
                                      ) : (
                                        <div className="break-words whitespace-normal">{String(row[column])}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500 italic text-sm">null</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Results Summary */}
                  {searchTerm && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <Filter className="inline h-4 w-4 mr-1" />
                      Showing {filteredAndSortedResults.length} of {results.length} results for "{searchTerm}"
                    </div>
                  )}
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
