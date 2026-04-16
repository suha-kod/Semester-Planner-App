// lib/db.ts — IndexedDB wrapper using idb

import { openDB, type IDBPDatabase } from 'idb'
import type { AppData } from '@/types'
import { defaultAppData, migrateData } from './migrations'

const DB_NAME = 'tracker-db'
const DB_VERSION = 1
const STORE = 'appdata'
const KEY = 'main'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      },
    })
  }
  return dbPromise
}

export async function loadFromDB(): Promise<AppData> {
  try {
    const db = await getDB()
    const raw = await db.get(STORE, KEY)
    if (!raw) return defaultAppData()
    return migrateData(raw)
  } catch (e) {
    console.error('IndexedDB load failed, using defaults', e)
    return defaultAppData()
  }
}

export async function saveToDB(data: AppData): Promise<void> {
  try {
    const db = await getDB()
    await db.put(STORE, data, KEY)
  } catch (e) {
    console.error('IndexedDB save failed', e)
  }
}

export async function clearDB(): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, KEY)
}
