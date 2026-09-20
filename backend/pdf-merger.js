import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

/**
 * Merges a list of image and PDF buffers into a single PDF document.
 * @param {Array<{ buffer: Buffer, type: 'image' | 'pdf' | string, fileName?: string }>} fileList 
 * @returns {Promise<Buffer>}
 */
export async function mergeFilesToPdf(fileList) {
    if (!Array.isArray(fileList) || fileList.length === 0) {
        throw new Error('هیچ فایلی برای ادغام ارسال نشده است.');
    }

    const mergedPdf = await PDFDocument.create();

    // Standard A4 dimensions in points (72 points per inch)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 20;
    const MAX_CONTENT_WIDTH = A4_WIDTH - (MARGIN * 2);
    const MAX_CONTENT_HEIGHT = A4_HEIGHT - (MARGIN * 2);

    for (let index = 0; index < fileList.length; index++) {
        const item = fileList[index];
        const { buffer, type, fileName } = item;

        if (!buffer || buffer.length === 0) {
            console.warn(`[PDF Merger] Skipping empty file at index ${index}`);
            continue;
        }

        const isPdf = type === 'pdf' || (fileName && /\.pdf$/i.test(fileName)) || isPdfBuffer(buffer);

        if (isPdf) {
            try {
                const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
                const pageIndices = srcPdf.getPageIndices();
                const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
                for (const page of copiedPages) {
                    mergedPdf.addPage(page);
                }
            } catch (pdfErr) {
                console.error(`[PDF Merger] Error processing PDF page at index ${index}:`, pdfErr.message);
            }
        } else {
            // Process Image (JPEG, PNG, WEBP, GIF, TIFF, BMP, etc.)
            try {
                // Use sharp to normalize and convert to standard PNG for lossless embedding
                const normalizedPng = await sharp(buffer)
                    .rotate() // Auto-orient based on EXIF
                    .png({ quality: 90, compressionLevel: 6 })
                    .toBuffer();

                const image = await mergedPdf.embedPng(normalizedPng);
                const { width: imgWidth, height: imgHeight } = image.scale(1);

                // Calculate scaling to fit within A4 margins while maintaining aspect ratio
                const scale = Math.min(
                    MAX_CONTENT_WIDTH / imgWidth,
                    MAX_CONTENT_HEIGHT / imgHeight,
                    1 // Don't upscale small images beyond 100%
                );

                const finalWidth = imgWidth * scale;
                const finalHeight = imgHeight * scale;

                const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
                const xPos = MARGIN + (MAX_CONTENT_WIDTH - finalWidth) / 2;
                const yPos = MARGIN + (MAX_CONTENT_HEIGHT - finalHeight) / 2;

                page.drawImage(image, {
                    x: xPos,
                    y: yPos,
                    width: finalWidth,
                    height: finalHeight,
                });
            } catch (imgErr) {
                console.error(`[PDF Merger] Error processing image at index ${index}:`, imgErr.message);
                
                // Fallback attempt: try embedding raw JPEG if sharp had issues
                try {
                    const jpgImage = await mergedPdf.embedJpg(buffer);
                    const { width: imgWidth, height: imgHeight } = jpgImage.scale(1);
                    const scale = Math.min(MAX_CONTENT_WIDTH / imgWidth, MAX_CONTENT_HEIGHT / imgHeight, 1);
                    const finalWidth = imgWidth * scale;
                    const finalHeight = imgHeight * scale;

                    const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
                    page.drawImage(jpgImage, {
                        x: MARGIN + (MAX_CONTENT_WIDTH - finalWidth) / 2,
                        y: MARGIN + (MAX_CONTENT_HEIGHT - finalHeight) / 2,
                        width: finalWidth,
                        height: finalHeight,
                    });
                } catch (fallbackErr) {
                    console.error(`[PDF Merger] Fallback image embed failed:`, fallbackErr.message);
                }
            }
        }
    }

    if (mergedPdf.getPageCount() === 0) {
        throw new Error('هیچ صفحه معتبری از فایل‌های ارسالی قابل استخراج و ادغام نبود.');
    }

    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
}

/**
 * Check if buffer header matches %PDF
 * @param {Buffer} buffer 
 * @returns {boolean}
 */
function isPdfBuffer(buffer) {
    if (!buffer || buffer.length < 4) return false;
    return buffer.slice(0, 4).toString('ascii') === '%PDF';
}
