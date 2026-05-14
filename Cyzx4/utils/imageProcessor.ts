/**
 * HTML5 Canvas based Image Processing Utilities
 * Used for pre-processing images before sending them to the AI API,
 * specifically for bypassing NSFW filters via edge detection (Lineart).
 */

/**
 * Applies a Sobel-like edge detection filter to a base64 image.
 * This converts a regular photo into a high-contrast lineart, stripping away
 * skin textures, lighting, and sensitive features while preserving posture/composition.
 * 
 * @param base64 The input image base64 string (data URI)
 * @returns A promise that resolves to the processed base64 string
 */
export const extractEdges = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;

            // Create a grayscale copy
            const grayscale = new Uint8ClampedArray(width * height);
            for (let i = 0; i < data.length; i += 4) {
                // Perceived luminance formula
                grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }

            // Sobel kernels
            const kernelX = [
                -1, 0, 1,
                -2, 0, 2,
                -1, 0, 1
            ];
            const kernelY = [
                -1, -2, -1,
                 0,  0,  0,
                 1,  2,  1
            ];

            const edgeData = new Uint8ClampedArray(data.length);

            // Apply Sobel operator
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let pixelX = 0;
                    let pixelY = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelIndex = ((y + ky) * width + (x + kx));
                            const weightX = kernelX[(ky + 1) * 3 + (kx + 1)];
                            const weightY = kernelY[(ky + 1) * 3 + (kx + 1)];
                            
                            pixelX += grayscale[pixelIndex] * weightX;
                            pixelY += grayscale[pixelIndex] * weightY;
                        }
                    }

                    const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
                    const idx = (y * width + x) * 4;
                    
                    // Invert edges: White background, black lines
                    // Also boost contrast to make lines clearer
                    const val = magnitude > 50 ? 0 : 255; 

                    edgeData[idx] = val;     // R
                    edgeData[idx + 1] = val; // G
                    edgeData[idx + 2] = val; // B
                    edgeData[idx + 3] = 255; // Alpha
                }
            }

            // Handle borders (just make them white)
            for (let i = 0; i < edgeData.length; i += 4) {
                if (edgeData[i + 3] === 0) {
                    edgeData[i] = 255;
                    edgeData[i+1] = 255;
                    edgeData[i+2] = 255;
                    edgeData[i+3] = 255;
                }
            }

            const newImageData = new ImageData(edgeData, width, height);
            ctx.putImageData(newImageData, 0, 0);

            // Output as JPEG to keep size small
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for edge extraction'));
        };

        // If it doesn't already have the data URI prefix, we might need to add it,
        // but typically the frontend handles full dataURIs.
        if (!base64.startsWith('data:image')) {
            // Best guess for mime if missing
            img.src = `data:image/jpeg;base64,${base64}`;
        } else {
            img.src = base64;
        }
    });
};
