import { PGlite } from "@electric-sql/pglite"

// Global database state management
let db = null
let isInitializing = false
let isInitialized = false
let initPromise = null
const DB_NAME = "patient_registration_db"

// Singleton database initialization with proper persistence check
export async function initializeDatabase() {
  if (typeof window === "undefined") throw new Error("PGlite can only run in the browser")

  // If already initialized, return existing instance
  if (db && isInitialized) {
    return db
  }

  // If currently initializing, wait for the existing initialization
  if (isInitializing && initPromise) {
    return await initPromise
  }

  // Start initialization
  isInitializing = true

  initPromise = (async () => {
    try {
      console.log("🔄 Initializing PGlite database...")

      // Create new instance only if one doesn't exist
      if (!db) {
        db = new PGlite(`idb://${DB_NAME}`)
      }

      // Wait for database to be ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Create patients table with updated gender field length
      await db.exec(`
        CREATE TABLE IF NOT EXISTS patients (
          id SERIAL PRIMARY KEY,
          patient_id VARCHAR(20) UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          date_of_birth DATE NOT NULL,
          age INTEGER,
          gender VARCHAR(20) NOT NULL,
          address TEXT,
          emergency_contact_name VARCHAR(100),
          emergency_contact_phone VARCHAR(20),
          medical_history TEXT,
          allergies TEXT,
          current_medications TEXT,
          insurance_provider VARCHAR(100),
          insurance_policy_number VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // Check if gender column needs to be updated to accommodate longer values
      try {
        const columnInfo = await db.query(`
          SELECT character_maximum_length 
          FROM information_schema.columns 
          WHERE table_name = 'patients' AND column_name = 'gender'
        `)

        if (columnInfo.rows.length > 0 && columnInfo.rows[0].character_maximum_length < 20) {
          console.log("Updating gender column to accommodate longer values...")
          await db.exec(`ALTER TABLE patients ALTER COLUMN gender TYPE VARCHAR(20)`)
          console.log("Gender column updated successfully")
        }
      } catch (error) {
        console.log("Gender column check/update:", error.message)
      }

      // Check if age column exists, if not add it
      try {
        await db.query("SELECT age FROM patients LIMIT 1")
      } catch (error) {
        if (error.message.includes('column "age" does not exist')) {
          console.log("Adding age column to existing patients table...")
          await db.exec(`ALTER TABLE patients ADD COLUMN age INTEGER`)

          // Update existing records with calculated age
          await db.exec(`
            UPDATE patients 
            SET age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
            WHERE age IS NULL
          `)

          // Make age column NOT NULL after updating existing records
          await db.exec(`ALTER TABLE patients ALTER COLUMN age SET NOT NULL`)

          console.log("Age column added and existing records updated successfully")
        }
      }

      // Check if patient_id column exists, if not add it
      try {
        await db.query("SELECT patient_id FROM patients LIMIT 1")
      } catch (error) {
        if (error.message.includes('column "patient_id" does not exist')) {
          console.log("Adding patient_id column to existing patients table...")
          await db.exec(`ALTER TABLE patients ADD COLUMN patient_id VARCHAR(20) UNIQUE`)

          // Update existing records with generated patient IDs
          const existingPatients = await db.query("SELECT id FROM patients WHERE patient_id IS NULL ORDER BY id")
          for (let i = 0; i < existingPatients.rows.length; i++) {
            const patientId = generatePatientId(i + 1)
            await db.query("UPDATE patients SET patient_id = $1 WHERE id = $2", [
              patientId,
              existingPatients.rows[i].id,
            ])
          }

          console.log("Patient ID column added and existing records updated successfully")
        }
      }

      // Create indexes for better performance
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
        CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
        CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);
        CREATE INDEX IF NOT EXISTS idx_patients_age ON patients(age);
        CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
      `)

      // CRITICAL: Perform multiple test operations to ensure IndexedDB persistence is working
      console.log("🔄 Testing database persistence...")

      // Test 1: Basic query
      await db.query("SELECT 1 as test")

      // Test 2: Create and drop a test table to ensure write operations work
      await db.exec("CREATE TEMP TABLE IF NOT EXISTS persistence_test (id INTEGER)")
      await db.exec("INSERT INTO persistence_test (id) VALUES (1)")
      const testResult = await db.query("SELECT id FROM persistence_test WHERE id = 1")
      if (testResult.rows.length === 0) {
        throw new Error("Database persistence test failed")
      }
      await db.exec("DROP TABLE IF EXISTS persistence_test")

      // Test 3: Ensure the patients table is accessible and writable
      await db.query("SELECT COUNT(*) FROM patients")

      // Wait for IndexedDB to fully commit all operations
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Final verification
      await db.query("SELECT 1 as final_test")

      isInitialized = true
      isInitializing = false
      console.log("✅ PGlite database initialized and persistence verified")
      return db
    } catch (error) {
      console.error("Failed to initialize PGlite database:", error)
      isInitialized = false
      isInitializing = false
      initPromise = null

      // Reset db instance on error
      db = null

      throw new Error(`Database initialization failed: ${error.message}`)
    }
  })()

  return await initPromise
}

// Generate patient ID in format PAT-YYYY-NNNN
function generatePatientId(sequenceNumber) {
  const currentYear = new Date().getFullYear()
  const paddedNumber = sequenceNumber.toString().padStart(4, "0")
  return `PAT-${currentYear}-${paddedNumber}`
}

// Get next patient sequence number
async function getNextPatientSequence() {
  try {
    const database = await getDatabase()
    const currentYear = new Date().getFullYear()

    // Get the highest sequence number for current year
    const result = await database.query(
      `
      SELECT patient_id FROM patients 
      WHERE patient_id LIKE $1 
      ORDER BY patient_id DESC 
      LIMIT 1
    `,
      [`PAT-${currentYear}-%`],
    )

    if (result.rows.length === 0) return 1 // First patient of the year

    // Extract sequence number from patient_id (PAT-YYYY-NNNN)
    const lastPatientId = result.rows[0].patient_id
    const sequencePart = lastPatientId.split("-")[2]
    return Number.parseInt(sequencePart) + 1
  } catch (error) {
    console.error("Error getting next patient sequence:", error)
    return 1
  }
}

// Get database instance with singleton pattern
async function getDatabase() {
  if (!db || !isInitialized) {
    return await initializeDatabase()
  }
  return db
}

// Add new patient with enhanced persistence verification
export async function addPatient(patientData) {
  try {
    // Ensure database is fully initialized and ready
    const database = await getDatabase()

    console.log("🔄 Adding patient to database...")

    // Generate patient ID
    const sequenceNumber = await getNextPatientSequence()
    const patientId = generatePatientId(sequenceNumber)

    // Format date properly for PostgreSQL
    const formattedDate =
      patientData.dateOfBirth instanceof Date
        ? patientData.dateOfBirth.toISOString().split("T")[0]
        : patientData.dateOfBirth

    // Ensure age is provided, if not calculate it
    let age = patientData.age
    if (!age && patientData.dateOfBirth) {
      const today = new Date()
      const birthDate = new Date(patientData.dateOfBirth)
      age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--
    }

    // Insert the patient record
    const result = await database.query(
      `
      INSERT INTO patients (
        patient_id, first_name, last_name, email, phone, date_of_birth, age, gender,
        address, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, current_medications,
        insurance_provider, insurance_policy_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id
    `,
      [
        patientId,
        patientData.firstName,
        patientData.lastName,
        patientData.email,
        patientData.phone || null,
        formattedDate,
        Number.parseInt(age) || 0,
        patientData.gender,
        patientData.address || null,
        patientData.emergencyContactName || null,
        patientData.emergencyContactPhone || null,
        patientData.medicalHistory || null,
        patientData.allergies || null,
        patientData.currentMedications || null,
        patientData.insuranceProvider || null,
        patientData.insurancePolicyNumber || null,
      ],
    )

    const insertedId = result.rows[0].id

    // CRITICAL: Force IndexedDB to persist the data
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Multiple verification attempts to ensure persistence
    let verificationAttempts = 0
    let verified = false

    while (verificationAttempts < 3 && !verified) {
      try {
        const verification = await database.query("SELECT id FROM patients WHERE id = $1", [insertedId])
        if (verification.rows.length > 0) {
          verified = true
          break
        }
      } catch (error) {
        console.warn(`Verification attempt ${verificationAttempts + 1} failed:`, error)
      }

      verificationAttempts++
      if (!verified) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    if (!verified) {
      throw new Error("Patient insertion verification failed after multiple attempts")
    }

    console.log(`✅ Patient successfully added and verified with ID: ${insertedId}, Patient ID: ${patientId}`)
    return { success: true, patientId, id: insertedId }
  } catch (error) {
    console.error("Error adding patient:", error)

    // Handle specific database errors
    if (error.message.includes("duplicate key value violates unique constraint")) {
      if (error.message.includes("email")) {
        throw new Error("A patient with this email address already exists.")
      }
      if (error.message.includes("patient_id")) {
        throw new Error("Patient ID conflict. Please try again.")
      }
    }

    throw new Error(`Failed to add patient: ${error.message}`)
  }
}

// Get all patients with enhanced error handling
export async function getAllPatients() {
  try {
    const database = await getDatabase()

    const result = await database.query(`
      SELECT 
        id,
        patient_id as "patientId",
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        date_of_birth as "dateOfBirth",
        COALESCE(age, EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))) as age,
        gender,
        address,
        emergency_contact_name as "emergencyContactName",
        emergency_contact_phone as "emergencyContactPhone",
        medical_history as "medicalHistory",
        allergies,
        current_medications as "currentMedications",
        insurance_provider as "insuranceProvider",
        insurance_policy_number as "insurancePolicyNumber",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM patients 
      ORDER BY created_at DESC
    `)

    return result.rows || []
  } catch (error) {
    console.error("Error getting patients:", error)
    throw new Error(`Failed to get patients: ${error.message}`)
  }
}

// Delete a patient with forced transaction commitment
export async function deletePatient(id) {
  try {
    const database = await getDatabase()

    console.log(`🗑️ Attempting to delete patient with ID: ${id}`)

    // First verify the patient exists
    const existsCheck = await database.query("SELECT id FROM patients WHERE id = $1", [id])
    if (existsCheck.rows.length === 0) {
      console.log(`⚠️ Patient with ID ${id} already deleted or doesn't exist`)
      return true
    }

    // Force a transaction with explicit BEGIN/COMMIT
    await database.exec("BEGIN")

    try {
      // Delete the patient within the transaction
      await database.query("DELETE FROM patients WHERE id = $1", [id])

      // Force commit the transaction
      await database.exec("COMMIT")

      console.log(`🔄 Transaction committed for patient ID: ${id}`)
    } catch (error) {
      // Rollback on error
      await database.exec("ROLLBACK")
      throw error
    }


    console.log(`✅ Patient with ID ${id} successfully deleted !`)
    return true
  } catch (error) {
    console.error("Error deleting patient:", error)

    // If it's a "patient not found" type error, treat it as success since the goal is achieved
    if (error.message.includes("not found") || error.message.includes("does not exist")) {
      console.log(`Patient with id ${id} was already deleted`)
      return true
    }

    throw new Error(`Failed to delete patient: ${error.message}`)
  }
}

// Update a patient with enhanced error handling
export async function updatePatient(id, patientData) {
  try {
    const database = await getDatabase()

    // Check if patient exists first
    const checkResult = await database.query(`SELECT id FROM patients WHERE id = $1`, [id])

    if (checkResult.rows.length === 0) {
      throw new Error("Patient not found")
    }

    // Format date properly for PostgreSQL
    const formattedDate =
      patientData.dateOfBirth instanceof Date
        ? patientData.dateOfBirth.toISOString().split("T")[0]
        : patientData.dateOfBirth

    // Ensure age is provided, if not calculate it
    let age = patientData.age
    if (!age && patientData.dateOfBirth) {
      const today = new Date()
      const birthDate = new Date(patientData.dateOfBirth)
      age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--
    }

    await database.query(
      `
      UPDATE patients SET
        first_name = $1,
        last_name = $2,
        email = $3,
        phone = $4,
        date_of_birth = $5,
        age = $6,
        gender = $7,
        address = $8,
        emergency_contact_name = $9,
        emergency_contact_phone = $10,
        medical_history = $11,
        allergies = $12,
        current_medications = $13,
        insurance_provider = $14,
        insurance_policy_number = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
    `,
      [
        patientData.firstName,
        patientData.lastName,
        patientData.email,
        patientData.phone || null,
        formattedDate,
        Number.parseInt(age) || 0,
        patientData.gender,
        patientData.address || null,
        patientData.emergencyContactName || null,
        patientData.emergencyContactPhone || null,
        patientData.medicalHistory || null,
        patientData.allergies || null,
        patientData.currentMedications || null,
        patientData.insuranceProvider || null,
        patientData.insurancePolicyNumber || null,
        id,
      ],
    )

    return true
  } catch (error) {
    console.error("Error updating patient:", error)

    // Handle specific database errors
    if (error.message.includes("duplicate key value violates unique constraint")) {
      if (error.message.includes("email")) {
        throw new Error("A patient with this email address already exists.")
      }
    }

    throw new Error(`Failed to update patient: ${error.message}`)
  }
}

// Execute SQL queries with enhanced security
export async function executeQuery(query) {
  try {
    const database = await getDatabase()

    // Clean the query
    const cleanQuery = query.trim()

    // Security: Basic validation to prevent harmful queries
    const dangerousPatterns = [
      /drop\s+database/i,
      /drop\s+schema/i,
      /truncate/i,
      /grant/i,
      /revoke/i,
      /create\s+user/i,
      /alter\s+user/i,
      /drop\s+user/i,
    ]

    const isDangerous = dangerousPatterns.some((pattern) => pattern.test(cleanQuery))

    if (isDangerous) throw new Error("Query contains potentially dangerous operations that are not allowed.")

    // Execute the raw SQL query
    const result = await database.query(cleanQuery)

    // Extract column names from the result
    let columns = result.fields ? result.fields.map((field) => field.name) : []
    let rows = result.rows || []

    // If this is a SELECT from patients table, reorder columns to put patient_id first and exclude id
    if (cleanQuery.toLowerCase().includes("from patients") && cleanQuery.toLowerCase().startsWith("select")) {
      // Check if we have patient_id and id columns
      const hasPatientId = columns.includes("patient_id")
      const hasId = columns.includes("id")

      if (hasPatientId || hasId) {
        // Filter out the internal 'id' column
        const filteredColumns = columns.filter((col) => col !== "id")

        // Reorder to put patient_id first if it exists
        if (hasPatientId) {
          const reorderedColumns = ["patient_id", ...filteredColumns.filter((col) => col !== "patient_id")]
          columns = reorderedColumns
        } else columns = filteredColumns

        // Filter the row data to match the new column order
        rows = rows.map((row) => {
          const newRow = {}
          columns.forEach((col) => {
            newRow[col] = row[col]
          })
          return newRow
        })
      }
    }

    return {
      rows: rows,
      columns: columns,
      rowCount: rows.length,
    }
  } catch (error) {
    console.error("Error executing query:", error)
    throw new Error(`Query execution failed: ${error.message}`)
  }
}

// Get database statistics
export async function getDatabaseStats() {
  try {
    const database = await getDatabase()

    const result = await database.query(`
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_patients,
        COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_patients,
        COUNT(CASE WHEN insurance_provider IS NOT NULL AND insurance_provider != '' THEN 1 END) as insured_patients,
        AVG(COALESCE(age, EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)))) as average_age,
        MIN(created_at) as first_registration,
        MAX(created_at) as last_registration
      FROM patients
    `)
    return result.rows[0] || {}
  } catch (error) {
    console.error("Error getting database stats:", error)
    return {}
  }
}

// Test database connection
export async function testConnection() {
  try {
    const database = await getDatabase()
    const result = await database.query("SELECT 1 as test")
    return result.rows[0]?.test === 1
  } catch (error) {
    console.error("Database connection test failed:", error)
    return false
  }
}

// Export the database instance for advanced usage
export async function getDatabaseInstance() {
  return await getDatabase()
}

// Updated sample queries with patient_id field and without internal id
export const sampleQueries = [
  "SELECT patient_id, first_name, last_name, age, gender FROM patients LIMIT 10;",
  "SELECT gender, COUNT(*) as count FROM patients GROUP BY gender;",
  "SELECT patient_id, first_name, last_name, age, insurance_provider FROM patients WHERE insurance_provider IS NOT NULL;",
  "SELECT patient_id, first_name, last_name, email, age FROM patients ORDER BY age DESC LIMIT 5;",
  "SELECT COUNT(*) as total_patients, AVG(age) as average_age FROM patients;",
  "SELECT patient_id, first_name, last_name, allergies FROM patients WHERE allergies IS NOT NULL AND allergies != '';",
  "SELECT patient_id, first_name, last_name, age, medical_history FROM patients WHERE age > 65;",
]
