/**
 * Almacenamiento persistente de grabaciones para SCREENREC.
 *
 * Los vídeos se guardan como Blob en IndexedDB, de modo que sobreviven al
 * recargar o cerrar la página. Se define una interfaz (`RecordingStore`) con dos
 * implementaciones: IndexedDB (real) y memoria (fallback y pruebas), lo que
 * permite probar la lógica sin depender del navegador.
 */

export interface StoredRecording {
  id: string;
  filename: string;
  blob: Blob;
  size: number;
  durationSeconds: number;
  createdAt: number;
}

export interface RecordingStore {
  getAll(): Promise<StoredRecording[]>;
  put(recording: StoredRecording): Promise<void>;
  update(id: string, patch: Partial<StoredRecording>): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  readonly persistent: boolean;
}

const DB_NAME = "screenrec";
const DB_VERSION = 1;
const STORE_NAME = "recordings";

/**
 * Implementación en memoria. Se usa como respaldo cuando IndexedDB no está
 * disponible (modo incógnito restrictivo, navegadores antiguos) y en pruebas.
 */
export class MemoryStore implements RecordingStore {
  public readonly persistent = false;
  private items = new Map<string, StoredRecording>();

  /**
   * Devuelve todas las grabaciones, de la más reciente a la más antigua.
   * @returns {Promise<StoredRecording[]>} Grabaciones almacenadas.
   */
  public async getAll(): Promise<StoredRecording[]> {
    return [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Guarda una grabación.
   * @param {StoredRecording} recording - Grabación a guardar.
   */
  public async put(recording: StoredRecording): Promise<void> {
    this.items.set(recording.id, recording);
  }

  /**
   * Actualiza campos de una grabación existente.
   * @param {string} id - Identificador.
   * @param {Partial<StoredRecording>} patch - Campos a modificar.
   */
  public async update(id: string, patch: Partial<StoredRecording>): Promise<void> {
    const current = this.items.get(id);
    if (current) this.items.set(id, { ...current, ...patch });
  }

  /**
   * Elimina una grabación.
   * @param {string} id - Identificador.
   */
  public async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  /**
   * Elimina todas las grabaciones.
   */
  public async clear(): Promise<void> {
    this.items.clear();
  }
}

/**
 * Implementación sobre IndexedDB.
 */
export class IndexedDbStore implements RecordingStore {
  public readonly persistent = true;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Abre (y crea si hace falta) la base de datos.
   * @returns {Promise<IDBDatabase>} Base de datos lista.
   */
  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (): void => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void =>
        reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    });

    return this.dbPromise;
  }

  /**
   * Ejecuta una operación dentro de una transacción.
   * @param {IDBTransactionMode} mode - Modo de la transacción.
   * @param {(store: IDBObjectStore) => IDBRequest} operation - Operación a ejecutar.
   * @returns {Promise<T>} Resultado de la operación.
   */
  private async run<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));

      request.onsuccess = (): void => resolve(request.result as T);
      request.onerror = (): void => reject(request.error ?? new Error("Error de almacenamiento"));
      transaction.onabort = (): void =>
        reject(transaction.error ?? new Error("Transacción cancelada: espacio insuficiente"));
    });
  }

  /**
   * Devuelve todas las grabaciones, de la más reciente a la más antigua.
   * @returns {Promise<StoredRecording[]>} Grabaciones almacenadas.
   */
  public async getAll(): Promise<StoredRecording[]> {
    const items = await this.run<StoredRecording[]>("readonly", (store) => store.getAll());
    return (items ?? []).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Guarda una grabación.
   * @param {StoredRecording} recording - Grabación a guardar.
   */
  public async put(recording: StoredRecording): Promise<void> {
    await this.run("readwrite", (store) => store.put(recording));
  }

  /**
   * Actualiza campos de una grabación existente.
   * @param {string} id - Identificador.
   * @param {Partial<StoredRecording>} patch - Campos a modificar.
   */
  public async update(id: string, patch: Partial<StoredRecording>): Promise<void> {
    const current = await this.run<StoredRecording | undefined>("readonly", (store) =>
      store.get(id)
    );
    if (!current) return;
    await this.put({ ...current, ...patch });
  }

  /**
   * Elimina una grabación.
   * @param {string} id - Identificador.
   */
  public async delete(id: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(id));
  }

  /**
   * Elimina todas las grabaciones.
   */
  public async clear(): Promise<void> {
    await this.run("readwrite", (store) => store.clear());
  }
}

/**
 * Indica si el navegador admite almacenamiento persistente.
 * @returns {boolean} true si IndexedDB está disponible.
 */
export function isPersistenceAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Crea el almacén más adecuado según el navegador.
 * @returns {RecordingStore} Almacén persistente o en memoria.
 */
export function createRecordingStore(): RecordingStore {
  return isPersistenceAvailable() ? new IndexedDbStore() : new MemoryStore();
}

/**
 * Estima el espacio usado y disponible para la app.
 * @returns {Promise<{ usedBytes: number; quotaBytes: number } | null>} Datos de uso o null si no se pueden obtener.
 */
export async function estimateStorage(): Promise<{
  usedBytes: number;
  quotaBytes: number;
} | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return {
      usedBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Pide al navegador que no borre los datos automáticamente si falta espacio.
 * @returns {Promise<boolean>} true si el almacenamiento quedó marcado como persistente.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
