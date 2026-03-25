/**
 * Brauzerda SVG faylni PNG data URL ga aylantiradi (jsPDF addImage uchun).
 */
export async function svgAssetToPngDataUrl(
    publicPath: string,
    targetWidthPx = 200
): Promise<string | null> {
    try {
        const res = await fetch(publicPath);
        if (!res.ok) return null;
        const svgText = await res.text();
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("SVG image load failed"));
            img.src = objectUrl;
        });
        const wPx = targetWidthPx;
        const hPx = Math.max(8, (img.height / img.width) * wPx);
        const canvas = document.createElement("canvas");
        canvas.width = wPx;
        canvas.height = hPx;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            return null;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, wPx, hPx);
        ctx.drawImage(img, 0, 0, wPx, hPx);
        URL.revokeObjectURL(objectUrl);
        return canvas.toDataURL("image/png");
    } catch {
        return null;
    }
}
