
/**
 * Utility to process and convert images on the client side.
 * Ensures all images are converted to JPEG to satisfy strict file-type validation.
 */

export interface ImageMetadata {
    company?: string;
    technician?: string;
    location?: { lat: number, lng: number };
    timestamp?: string;
}

export async function convertToJpeg(
    file: File | Blob, 
    maxDimension: number = 2000, 
    quality: number = 0.8,
    metadata?: ImageMetadata
): Promise<File> {
    return new Promise((resolve, reject) => {
        const fileName = (file as File).name || 'image.jpg';
        const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || 'image';
        const finalName = `${baseName}.jpg`;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_DIM = maxDimension;
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                    } else {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // --- WATERMARK IMPLEMENTATION ---
                if (metadata) {
                    const bandHeight = Math.round(height * 0.08); // 8% of height
                    const fontSize = Math.max(Math.round(bandHeight * 0.3), 12);
                    
                    // Semi-transparent black band
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(0, height - bandHeight, width, bandHeight);

                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textBaseline = 'middle';

                    const padding = 20;
                    const lineSpacing = fontSize * 1.2;
                    const startY = height - (bandHeight / 2) - (lineSpacing / 2) + 5;

                    // Line 1: Company & Technician
                    const infoLine1 = `${metadata.company || 'RAPILINK SAS'} | TÉC: ${metadata.technician || 'SOPORTE'}`.toUpperCase();
                    ctx.fillText(infoLine1, padding, startY);

                    // Line 2: Date & Location
                    const now = metadata.timestamp || new Date().toLocaleString();
                    const locStr = metadata.location 
                        ? ` | GPS: ${metadata.location.lat.toFixed(6)}, ${metadata.location.lng.toFixed(6)}` 
                        : '';
                    const infoLine2 = `${now}${locStr}`.toUpperCase();
                    ctx.fillText(infoLine2, padding, startY + lineSpacing);
                }

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const jpegFile = new File([blob], finalName, { type: 'image/jpeg' });
                            resolve(jpegFile);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

// Alias for backward compatibility
export const compressImage = convertToJpeg;
