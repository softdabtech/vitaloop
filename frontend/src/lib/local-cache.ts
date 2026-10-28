const DB_NAME = 'vitaloop'
const DB_VERSION = 1
const STORES = {
  biomarkers: 'biomarkers',
  results: 'results',
  uploads: 'uploads',
}

export class LocalCache {
  private db: IDBDatabase | null = null

  async init() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        })
      }
    })
  }

  async set(store: keyof typeof STORES, key: string, value: any) {
    if (!this.db) await this.init()
    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORES[store]], 'readwrite')
      const objectStore = tx.objectStore(STORES[store])
      const request = objectStore.put({ id: key, ...value, timestamp: Date.now() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async get(store: keyof typeof STORES, key: string) {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES[store]], 'readonly')
      const objectStore = tx.objectStore(STORES[store])
      const request = objectStore.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async clear(store: keyof typeof STORES) {
    if (!this.db) await this.init()
    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([STORES[store]], 'readwrite')
      const objectStore = tx.objectStore(STORES[store])
      const request = objectStore.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export const localCache = new LocalCache()
