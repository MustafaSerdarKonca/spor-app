/**
 * Image processing utilities
 */

/**
 * Reads a file input and returns a resized base64 string
 * @param {File} file - The file object from input
 * @param {number} maxWidth - Max width to resize to (default 400px)
 * @param {number} quality - JPEG quality 0-1 (default 0.7)
 * @returns {Promise<string>} - Base64 data URL
 */
export const processImage = (file, maxWidth = 400, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image.*/)) {
            reject(new Error("Not an image"));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }

                // Draw to canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Export
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
};
