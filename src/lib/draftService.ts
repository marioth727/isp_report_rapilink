
/**
 * Service to handle local drafts of ticket evidence using IndexedDB.
 * This allows persisting files (Blobs/Files) that localstorage cannot handle well.
 */

const DB_NAME = 'isp_reports_drafts';
const STORE_NAME = 'ticket_drafts';
const DB_VERSION = 1;

class DraftService {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve(this.db!);
            };

            request.onerror = (event: any) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Saves a list of files as a draft for a specific ticket.
     */
    async saveDraft(ticketId: string, files: File[]): Promise<void> {
        if (!ticketId) return;
        const db = await this.getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Convert Files to Blobs for IndexedDB storage compatibility in all browsers
            const data = files.map(file => ({
                blob: file,
                name: file.name,
                type: file.type,
                lastModified: file.lastModified
            }));

            const request = store.put(data, ticketId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieves the draft files for a specific ticket.
     */
    async getDraft(ticketId: string): Promise<File[]> {
        if (!ticketId) return [];
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(ticketId);

            request.onsuccess = () => {
                const data = request.result;
                if (!data || !Array.isArray(data)) {
                    resolve([]);
                    return;
                }

                // Reconstruct Files from Blobs
                const files = data.map((item: any) => 
                    new File([item.blob], item.name, { 
                        type: item.type,
                        lastModified: item.lastModified 
                    })
                );
                resolve(files);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clears the draft for a specific ticket.
     */
    async clearDraft(ticketId: string): Promise<void> {
        if (!ticketId) return;
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(ticketId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const draftService = new DraftService();
