// A photo's small copy (for the Live tiles) is saved next to it with "-t.jpg" in place of its extension
// (see /api/items/[id]/picture). No database column is needed: the thumbnail's address comes from the photo's address.
export function thumbUrlOf(url: string): string { return url.replace(/\.(jpe?g|png|webp)$/i, '-t.jpg') }
export function thumbPathOf(path: string): string { return path.replace(/\.(jpe?g|png|webp)$/i, '-t.jpg') }
